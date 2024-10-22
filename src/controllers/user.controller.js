import User from "../models/user.model.js";
import sendEmail from "../utils/mailService.js";

// generate access and refresh token

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error.message);
    throw new Error("Internal server error. Please try again later.");
  }
};

const registerUser = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "provide user email and password" });
    }

    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(400).json({ error: "User is already Exist" });
    }
    const user = await User.create({
      name,
      email,
      password,
    });
    return res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
    return res.status(500).json({ error: "Server Error" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Provide the email and password" });
  }
  const user = await User.findOne({ email }).select("+password");
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!user || !isPasswordValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
      message: "User login Successfully",
      user: loggedInUser,
      accessToken,
      refreshToken,
    });
};

// Function to handle forgot password (generating OTP and sending to email)
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please provide an email address." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Generate OTP and expiration
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpire = new Date(Date.now() + 5 * 60 * 1000); // 1 minute expiration

    // Update user with OTP and expiration
    user.otp = otp;
    user.otpExpire = otpExpire;
    await user.save();

    // Send OTP via email using sendEmail utility
    try {
      await sendEmail(
        email,
        "Password Reset OTP",
        `Your OTP code is ${otp} (expires in 1 minute).`
      );
      return res
        .status(200)
        .json({ message: "OTP has been sent to your email." });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to send OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error in forgot password:", error.message);
    return res
      .status(500)
      .json({ error: "Server error. Please try again later." });
  }
};
const resetPassword = async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  // Check if all required fields are present
  if (!email || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Check if new password and confirm password match
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  try {
    // Find the user by email and valid OTP
    const user = await User.findOne({
      email,
      otp,
      otpExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    // Use the model method to update the password and clear OTP
    const updatePassword = await user.updatePassword(newPassword);
    console.log(updatePassword)

    return res.status(200).json({
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Error resetting password:", error.message);
    return res
      .status(500)
      .json({ error: "Server error. Please try again later." });
  }
};

const logoutUser = async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({
      message: "User logged out successfully",
    });
};

const refreshAccessToken = async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return res.status(403).json({ error: "User not found" });
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      return res.status(401).json({ error: "Refresh token does not match" });
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json({
        message: "Access token refreshed",
        accessToken,
        refreshToken: newRefreshToken,
      });
  } catch (error) {
    console.error("Error refreshing access token:", error.message);
    return res.status(500).json({
      error: "Internal server error. Please try again later.",
    });
  }
};

export {
  registerUser,
  generateAccessAndRefereshTokens,
  loginUser,
  forgotPassword,
  resetPassword,
  logoutUser,
  refreshAccessToken,
};
