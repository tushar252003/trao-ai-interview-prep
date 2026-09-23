import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model("User", UserSchema);
