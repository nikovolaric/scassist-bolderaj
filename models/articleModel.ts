import { Schema, model } from "mongoose";

interface IArticle {
  name: {
    sl: string;
    en: string;
  };
  price: number;
  taxRate: number;
  priceDDV: number;
  type: string;
  ageGroup: string[];
  visits: number;
  duration: number;
  activationDuration: number;
  label: string;
  hiddenReception: boolean;
  hiddenUsers: boolean;
  morning: boolean;
  noClasses: number;
  startDate: Date;
  endDate: Date;
  gift: boolean;
  classPriceData: {
    price: number;
    priceDDV: number;
  };
}

const articleSchema = new Schema<IArticle>(
  {
    name: {
      sl: {
        type: String,
        required: [true, "Ticket item must have a name"],
      },
      en: {
        type: String,
        required: [true, "Ticket item must have a name"],
      },
    },
    price: {
      type: Number,
    },
    taxRate: {
      type: Number,
      required: [true, "Ticket item must have a tax rate"],
    },
    priceDDV: {
      type: Number,
      required: [true, "Ticket item must have a price"],
    },
    type: {
      type: String,
      enum: ["dnevna", "paket", "terminska"],
    },
    morning: Boolean,
    ageGroup: {
      type: [String],
      enum: ["preschool", "school", "student", "adult"],
    },
    visits: Number,
    duration: Number,
    activationDuration: Number,
    label: {
      type: String,
      enum: ["V", "VV", "A", "O"],
    },
    noClasses: Number,
    hiddenReception: {
      type: Boolean,
      default: true,
    },
    hiddenUsers: {
      type: Boolean,
      default: true,
    },
    startDate: Date,
    endDate: Date,
    gift: Boolean,
  },
  { timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

articleSchema.pre("save", function (next) {
  if (!this.isNew && this.isModified("name")) return next();

  this.price = parseFloat((this.priceDDV / (1 + this.taxRate)).toFixed(2));

  next();
});

articleSchema.virtual("classPriceData").get(function () {
  if (this.endDate) {
    const ms = 1000 * 60 * 60 * 24 * 7;
    const totalWeeks = Math.floor(
      (Date.parse(this.endDate.toDateString()) -
        Date.parse(this.startDate.toDateString())) /
        ms
    );
    const weeksLeft = Math.floor(
      (Date.parse(this.endDate.toDateString()) - Date.now()) / ms
    );

    if (this.startDate < new Date()) {
      const price = parseFloat(
        ((this.price * weeksLeft) / totalWeeks).toFixed(2)
      );
      const priceDDV = parseFloat((price * (1 + this.taxRate)).toFixed(2));

      const classPriceData = {
        price,
        priceDDV,
      };

      return classPriceData;
    } else {
      return {
        price: this.price,
        priceDDV: this.priceDDV,
      };
    }
  }

  if (this.label == "A" && !this.endDate) {
    const classPriceData = {
      price: this.price,
      priceDDV: this.priceDDV,
    };

    return classPriceData;
  }
});

const Article = model<IArticle>("Article", articleSchema);

export default Article;
