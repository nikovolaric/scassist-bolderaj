import { model, Schema } from "mongoose";
import { isMobilePhone } from "validator";
import bcrypt from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import { createHash, randomBytes } from "crypto";

interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  phoneNumber: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  password: string;
  passwordConfirm: string | undefined;
  role: string[];
  canInvoice: Boolean;
  taxNo: string;
  invoiceNickname: string;
  company: Schema.Types.ObjectId | undefined;
  unusedTickets: Schema.Types.ObjectId[];
  usedTickets: Schema.Types.ObjectId[];
  visits: Schema.Types.ObjectId[];
  agreesToTerms: Boolean;
  signedForNewsletter: Boolean;
  parentOf: {
    child: Schema.Types.ObjectId;
    agreesToTerms: boolean;
    signedAt: Date;
  }[];
  parentContact: { phoneNumber: string; email: string } | undefined;
  childActivationCode: { code: string; signedAt: Date } | undefined;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt: Date;
  passwordResetToken: String | undefined;
  passwordResetExpires: Date | undefined;
  active: Boolean;
  correctPassword: Function;
  find: Function;
  changedPasswordAfter: Function;
  createPasswordResetToken: Function;
  populate: Function;
}

const userSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, "User must have a first name"],
  },
  lastName: {
    type: String,
    required: [true, "User must have a last name"],
  },
  birthDate: {
    type: Date,
    required: [true, "User must have a birth date"],
  },
  phoneNumber: {
    type: String,
    required: [true, "User must have a phone number"],
    validate: isMobilePhone,
  },
  email: {
    type: String,
    validate: isEmail,
    unique: true,
  },
  address: {
    type: String,
    required: [true, "User must have an address"],
  },
  city: {
    type: String,
    required: [true, "User must have a city"],
  },
  postalCode: {
    type: String,
    required: [true, "User must have a postal code"],
  },
  country: {
    type: String,
    required: [true, "User must have a country"],
  },
  password: {
    type: String,
    minlength: [8, "Password must be at least 8 characters long"],
  },
  passwordConfirm: {
    type: String,
    validate: {
      validator: function (val) {
        return val === this.password;
      },
      message: "Passwords must match",
    },
  },
  role: [
    {
      type: String,
      enum: ["admin", "user", "coach", "employee", "routeSetter"],
      required: [true, "User must have a role"],
      default: "user",
    },
  ],
  canInvoice: {
    type: Boolean,
    default: false,
  },
  taxNo: {
    type: String,
  },
  invoiceNickname: {
    type: String,
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: "Company",
  },
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
  visits: [
    {
      type: Schema.Types.ObjectId,
      ref: "Visit",
    },
  ],
  agreesToTerms: {
    type: Boolean,
    default: false,
  },
  signedForNewsletter: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  updatedAt: {
    type: Date,
    default: Date.now(),
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  parentOf: [
    {
      child: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      agreesToTerms: Boolean,
      signedAt: Date,
    },
  ],
  parentContact: {
    phoneNumber: String,
    email: String,
  },
  childActivationCode: { code: { type: String, unique: true }, signedAt: Date },
  active: {
    type: Boolean,
    defailt: true,
    select: false,
  },
});

userSchema.pre("save", async function (next) {
  if (this.passwordResetExpires || !this.isModified("password")) return next();

  if (!this.agreesToTerms)
    return next(new Error("You must agree to terms and conditions"));

  this.phoneNumber = this.phoneNumber.replaceAll(" ", "");

  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordConfirm = undefined;
  }

  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.pre(/^find/, function (next) {
  //this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// userSchema.pre(/^find/, function (next) {
//   // @ts-ignore
//   this.populate({
//     path: "vehicle",
//     select: "-__v -user",
//   });

//   next();
// });

userSchema.methods.correctPassword = async function (
  candidatePassword: string,
  userPassword: string
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp: number) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      (this.passwordChangedAt.getTime() / 1000).toString(),
      10
    );
    return JWTTimestamp < changedTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = randomBytes(32).toString("hex");

  this.passwordResetToken = createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = model<IUser>("User", userSchema);

export default User;
