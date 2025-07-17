import { model, Schema, Types } from "mongoose";
import { sendPreInvoice } from "../utils/email";

interface IPreInvoice {
  buyer: Schema.Types.ObjectId;
  recepient: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    email: string;
    phoneNumber: string;
  };
  company: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    taxNumber: string;
  };
  preInvoiceNumber: number;
  date: Date;
  dueDate: Date;
  reference: string;
  items: {
    item: string;
    quantity: number;
    taxableAmount: number;
    amountWithTax: number;
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
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    recepient: {
      name: {
        type: String,
      },
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      postalCode: {
        type: String,
      },
      email: String,
      phoneNumber: String,
    },
    company: {
      name: String,
      address: String,
      postalCode: String,
      city: String,
      taxNumber: String,
    },
    preInvoiceNumber: Number,
    date: {
      type: Date,
      default: () => new Date(),
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
        amountWithTax: {
          type: Number,
          required: [true, "Invoice must have a taxable amount"],
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
        (acc, soldItem) => acc + soldItem.amountWithTax * soldItem.quantity,
        0
      )
      .toFixed(2)
  );

  this.reference = `SI00 ${Math.random()
    .toString()
    .substring(2, 10)}${new Date().getFullYear().toString().slice(2)}`;

  next();
});

// preInvoiceSchema.post("save", async function (doc, next) {
//   if (doc.isNew) {
//     await doc.populate({
//       path: "buyer",
//       select: "email firstName lastName phoneNumber postalCode city address",
//     });
//     const buyer = doc.buyer as any;

//     const mailOptions = {
//       email: doc.buyer ? buyer.email : doc.recepient.email,
//       preInvoiceNumber: `${doc.preInvoiceNumber}-${new Date().getFullYear()}`,
//       invoiceDate: doc.date,
//       companyName: doc.company.name,
//       reference: doc.reference,
//       name: buyer ? `${buyer.firstName} ${buyer.lastName}` : doc.recepient.name,
//       address: doc.company.address
//         ? doc.company.address
//         : buyer
//         ? buyer.address
//         : doc.recepient.address,
//       postalCode: doc.company.postalCode
//         ? doc.company.postalCode
//         : buyer
//         ? buyer.postalCode
//         : doc.recepient.postalCode,
//       city: doc.company.city
//         ? doc.company.city
//         : buyer
//         ? buyer.city
//         : doc.recepient.city,
//       taxNumber: doc.company.taxNumber,
//       paymentMethod: "nakazilo",
//       dueDate: doc.dueDate,
//       items: doc.items,
//       totalAmount: doc.totalAmount,
//       taxAmount: doc.totalAmount - doc.totalTaxableAmount,
//     };

//     await sendPreInvoice(mailOptions);

//     next();
//   }
// });

const PreInvoice = model<IPreInvoice>("PreInvoice", preInvoiceSchema);

export default PreInvoice;
