import { Router } from "express";
import { forgotPassword, loginUser, registerUser, resetPassword } from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);



export default router;