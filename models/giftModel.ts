import { model, Schema, Types } from "mongoose";

interface IGift {
  article: Types.ObjectId;
  giftCode: string;
  label: string;
  used: boolean;
  expires: Date;
}

const giftSchema = new Schema<IGift>(
  {
    article: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    giftCode: {
      type: String,
      required: true,
      unique: true,
    },
    label: { type: String, required: true },
    used: Boolean,
    expires: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

const Gift = model<IGift>("Gift", giftSchema);

export default Gift;
