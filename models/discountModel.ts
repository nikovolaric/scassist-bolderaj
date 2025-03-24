import { model, Schema } from "mongoose";

interface IDiscount {
  code: string;
  value: number;
}

const discountSchema = new Schema<IDiscount>({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: Number,
    required: true,
  },
});

const Discount = model<IDiscount>("Discount", discountSchema);

export default Discount;
