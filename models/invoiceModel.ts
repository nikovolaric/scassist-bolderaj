import { Schema, model } from "mongoose";
import User from "./userModel";

interface IInvoice {
  buyer: Schema.Types.ObjectId;
  companyId: Schema.Types.ObjectId;
  recepient: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    email: string;
    phoneNumber: string;
  };
  company: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    taxNumber: string;
    email: string;
  };
  invoiceDate: Date;
  serviceCompletionDate: Date;
  paymentDueDate: Date | string;
  invoiceData: {
    businessPremises: string;
    deviceNo: string;
    invoiceNo: number;
    year: number;
  };
  soldItems: {
    taxRate: number;
    taxableAmount: number;
    amountWithTax: number;
    quantity: number;
    item: string;
  }[];
  totalTaxableAmount: number;
  totalAmount: number;
  paymentMethod: string;
  issuer: Schema.Types.ObjectId;
  ZOI: string;
  EOR: string | undefined;
  soldBy: string | undefined;
  reference: string;
  storno: boolean;
  issuerNickname: string;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    recepient: {
      name: String,
      address: String,
      postalCode: String,
      city: String,
      email: String,
      phoneNumber: String,
    },
    company: {
      name: String,
      address: String,
      postalCode: String,
      city: String,
      taxNumber: String,
      email: String,
    },
    invoiceDate: {
      type: Date,
      default: () => new Date(),
      required: [true, "Invoice must have an invoice date"],
    },
    serviceCompletionDate: {
      type: Date,
      required: [true, "Invoice must have a service completion date"],
      default: () => new Date(),
    },
    paymentDueDate: {
      type: Date || String,
      required: [true, "Invoice must have a payment due date"],
    },
    invoiceData: {
      businessPremises: {
        type: String,
      },
      deviceNo: {
        type: String,
      },
      invoiceNo: {
        type: Number,
      },
      year: {
        type: Number,
        default: new Date().getFullYear(),
      },
    },
    soldItems: [
      {
        taxRate: {
          type: Number,
          required: [true, "Invoice must have a tax rate"],
        },
        taxableAmount: {
          type: Number,
          required: [true, "Invoice must have a taxable amount"],
        },
        amountWithTax: {
          type: Number,
          required: [true, "Invoice must have a taxable amount"],
        },
        quantity: {
          type: Number,
          required: [true, "Invoice must have a quantity"],
        },
        item: {
          type: String,
          required: [true, "Invoice must have an item"],
        },
      },
    ],
    totalTaxableAmount: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    paymentMethod: {
      type: String,
      enum: ["gotovina", "nakazilo", "card", "online", "paypal"],
    },
    issuer: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    issuerNickname: String,
    ZOI: String,
    EOR: String,
    soldBy: String,
    reference: {
      type: String,
      unique: true,
    },
    storno: Boolean,
  },
  { timestamps: true }
);

invoiceSchema.pre("save", function (next) {
  if (!this.isNew) return next();
  this.totalTaxableAmount = parseFloat(
    this.soldItems
      .reduce((acc, item) => acc + item.taxableAmount * item.quantity, 0)
      .toFixed(2)
  );

  this.totalAmount = parseFloat(
    this.soldItems
      .reduce(
        (acc, soldItem) => acc + soldItem.amountWithTax * soldItem.quantity,
        0
      )
      .toFixed(2)
  );

  if (!this.reference) {
    this.reference = `SI00 ${Math.random()
      .toString()
      .substring(2, 10)}${new Date().getFullYear().toString().slice(2)}`;
  }

  next();
});

invoiceSchema.pre("save", async function (next) {
  if (this.issuer) {
    const user = await User.findById(this.issuer);

    if (user) {
      this.issuerNickname = user.invoiceNickname as string;
    }
  }

  next();
});

const Invoice = model<IInvoice>("Invoice", invoiceSchema);

export default Invoice;
