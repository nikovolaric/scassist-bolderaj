import dotenv from "dotenv";
import mongoose from "mongoose";
import app from "./app";

process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log("UNHANDELED EXCEPTION! Shutting down..");

  process.exit(1);
});

dotenv.config({ path: "./config.env" });

if (process.env.DATABASE && process.env.DATABASE_PASSWORD) {
  const DB = process.env.DATABASE.replace(
    "<PASSWORD>",
    process.env.DATABASE_PASSWORD
  );

  const port = process.env.APP_PORT;
  const server = app.listen(port, () => {
    console.log(`App running on port ${port}...`);
  });

  async function main() {
    await mongoose.connect(DB);
    console.log("DB connection sucessfull");
  }
  main().catch((err) => {
    console.log(err.name, err.message);
    console.log("UNHANDELED REJECTION! Shutting down..");
    server.close(() => {
      process.exit(1);
    });
  });
}
