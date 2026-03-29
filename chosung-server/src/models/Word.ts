import mongoose from "mongoose";

const WordSchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true, index: true },
  definition: { type: String, default: "" },
  exist: { type: Boolean, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const WordModel = mongoose.model("Word", WordSchema);
