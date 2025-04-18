import { model, Schema, Types } from "mongoose";
import { sendPreInvoice } from "../utils/email";

interface IPreInvoice {
  recepient: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    company: string;
    taxNumber: string;
    email: string;
    phoneNumber: string;
  };
  preInvoiceNumber: number;
  date: Date;
  dueDate: Date;
  reference: string;
  items: {
    item: string;
    quantity: number;
    taxableAmount: number;
    taxRate: number;
  }[];
  totalTaxableAmount: number;
  totalAmount: number;
  payed: boolean;
  user: Types.ObjectId;
  classes: Types.ObjectId[];
}

const preInvoiceSchema = new Schema<IPreInvoice>(
  {
    recepient: {
      name: {
        type: String,
        required: [true, "Recepient must have a name"],
      },
      address: {
        type: String,
        required: [true, "Recepient must have an address"],
      },
      city: {
        type: String,
        required: [true, "Recepient must have a city"],
      },
      postalCode: {
        type: String,
        required: [true, "Recepient must have a postal code"],
      },
      company: String,
      taxNumber: String,
      email: String,
      phoneNumber: String,
    },
    preInvoiceNumber: Number,
    date: {
      type: Date,
      default: Date.now(),
      required: [true, "Pre-invoice must have a date"],
    },
    dueDate: {
      type: Date,
      required: [true, "Pre-invoice must have a due date"],
    },
    reference: {
      type: String,
    },
    items: [
      {
        item: {
          type: String,
          required: [true, "Item must have a name"],
        },
        quantity: {
          type: Number,
          required: [true, "Item must have a quantity"],
        },
        taxableAmount: {
          type: Number,
          required: [true, "Item must have a price"],
        },
        taxRate: {
          type: Number,
          required: [true, "Item must have a tax rate"],
        },
      },
    ],
    totalTaxableAmount: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    payed: Boolean,
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    classes: [
      {
        type: Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
  },
  { timestamps: true }
);

preInvoiceSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const preInvoice = await PreInvoice.findOne({}).sort({
    preInvoiceNumber: -1,
  });

  if (!preInvoice) {
    this.preInvoiceNumber = 1;
    return next();
  }

  this.preInvoiceNumber = preInvoice.preInvoiceNumber + 1;

  next();
});

preInvoiceSchema.pre("save", function (next) {
  if (!this.isNew) return next();

  this.totalTaxableAmount = parseFloat(
    this.items
      .reduce((acc, item) => acc + item.taxableAmount * item.quantity, 0)
      .toFixed(2)
  );

  this.totalAmount = parseFloat(
    this.items
      .reduce(
        (acc, soldItem) =>
          acc +
          soldItem.taxableAmount * (1 + soldItem.taxRate) * soldItem.quantity,
        0
      )
      .toFixed(2)
  );

  this.reference = `SI00 ${Math.random()
    .toString()
    .substring(2, 10)}-${new Date().getFullYear().toString().slice(2)}`;

  next();
});

preInvoiceSchema.post("save", async function (doc, next) {
  const mailOptions = {
    email: doc.recepient.email,
    preInvoiceNumber: `${doc.preInvoiceNumber}-${new Date().getFullYear()}`,
    invoiceDate: doc.date,
    companyName: doc.recepient.company,
    reference: doc.reference,
    name: doc.recepient.name,
    address: doc.recepient.address,
    postalCode: doc.recepient.postalCode,
    city: doc.recepient.city,
    taxNumber: doc.recepient.taxNumber,
    paymentMethod: "nakazilo",
    dueDate: doc.dueDate,
    items: doc.items,
    totalAmount: doc.totalAmount,
    taxAmount: doc.totalAmount - doc.totalTaxableAmount,
  };

  await sendPreInvoice(mailOptions);

  next();
});

const PreInvoice = model<IPreInvoice>("PreInvoice", preInvoiceSchema);

export default PreInvoice;
