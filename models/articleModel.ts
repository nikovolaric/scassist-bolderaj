import { Schema, model } from "mongoose";

interface IArticle {
  name: string;
  price: number;
  taxRate: number;
  priceDDV: number;
  type: string;
  ageGroup: string;
  visits: number;
  duration: number;
  class: Schema.Types.ObjectId;
  label: string;
  hidden: boolean;
}

const articleSchema = new Schema<IArticle>(
  {
    name: {
      type: String,
      required: [true, "Ticket item must have a name"],
    },
    price: {
      type: Number,
      required: [true, "Ticket item must have a price"],
    },
    taxRate: {
      type: Number,
      required: [true, "Ticket item must have a tax rate"],
    },
    priceDDV: Number,
    type: {
      type: String,
      enum: ["dnevna", "paket", "terminska", "dopoldanska"],
    },
    ageGroup: {
      type: String,
      enum: ["preschool", "school", "student", "adult"],
    },
    visits: Number,
    duration: Number,
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
    label: {
      type: String,
      enum: ["V", "T", "I"],
    },
    hidden: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

articleSchema.pre("save", function (next) {
  if (!this.isNew && this.isModified("name")) return next();

  this.priceDDV = Number((this.price + this.price * this.taxRate).toFixed(2));

  next();
});

const Article = model<IArticle>("Article", articleSchema);

export default Article;
