import mongoose, { Schema } from "mongoose";

const KitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fingerprint: { type: String, required: true, index: true },
    source: { type: Object, required: true },
    company_brief: { type: Object, required: true },
    role: { type: Object, required: true },
    questions: { type: Array, required: true },
    flashcards: { type: Array, required: true },
    schedule: { type: Object, required: true },
    coverage: { type: Object, required: true }
  },
  { timestamps: true, minimize: false }
);

KitSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });

export const KitModel = mongoose.model("Kit", KitSchema);
