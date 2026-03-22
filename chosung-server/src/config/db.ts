import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("MONGODB_URI가 없습니다.");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB 연결 성공!");
  } catch (err) {
    console.error("연결 에러:", err);
  }
};
