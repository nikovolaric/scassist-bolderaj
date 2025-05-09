import { model, Schema, Types } from "mongoose";

interface IGift {
  article: Types.ObjectId;
  giftCode: string;
  expires: Date;
}

const giftSchema = new Schema<IGift>(
  {
    article: {
      type: Schema.Types.ObjectId,
      ref: "Article",
    },
    giftCode: {
      type: String,
      require: true,
      unique: true,
    },
    expires: {
      type: Date,
      default: Date.now() + 365 * 24 * 60 * 60 * 1000,
    },
  },
  { timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

const Gift = model<IGift>("Gift", giftSchema);

export default Gift;
