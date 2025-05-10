import { model, Query, Schema } from "mongoose";

interface ICompany {
  companyTaxNo: string;
  companyName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  users: Schema.Types.ObjectId[];
  unusedTickets: Schema.Types.ObjectId[];
  usedTickets: Schema.Types.ObjectId[];
}

const companySchema = new Schema<ICompany>(
  {
    companyTaxNo: {
      type: String,
      required: [true, "Company must have a tax number"],
    },
    companyName: {
      type: String,
      required: [true, "Company must have a name"],
    },
    companyAddress: {
      type: String,
      required: [true, "Company must have an address"],
    },
    companyPostalCode: {
      type: String,
      required: [true, "Company must have a postal code"],
    },
    companyCity: {
      type: String,
      required: [true, "Company must have a city"],
    },
    companyPhone: {
      type: String,
      required: [true, "Company must have a phone number"],
    },
    companyEmail: {
      type: String,
      required: [true, "Company must have an email"],
    },
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    unusedTickets: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ticket",
      },
    ],
    usedTickets: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ticket",
      },
    ],
  },
  { timestamps: true }
);

companySchema.pre("save", function (next) {
  if (this.isNew) {
    this.companyPhone = this.companyPhone.replaceAll(" ", "");
  }

  next();
});

companySchema.pre(/^find/, function (next) {
  if (this instanceof Query) {
    this.populate({
      path: "users",
      select: "firstName lastName email",
    });
  }

  next();
});

const Company = model<ICompany>("Company", companySchema);

export default Company;
