import dotenv from "dotenv";
import connectDB from "./src/db/index.js";
import { app } from "./app.js";
dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`); // Accessing environment variables using process.env.PORT
    });
  })
  .catch(() => {
    console.log("Error connecting to DB");
    process.exit(1); // Exit the process if there's an error connecting to the DB
  });
