import { model, Schema, Types } from "mongoose";
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
  age: number;
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
    child: Types.ObjectId;
    agreesToTerms: boolean;
    signedAt: Date;
  }[];
  parent: Types.ObjectId | undefined;
  parentContact: { phoneNumber: string; email: string } | undefined;
  childActivationCode: { code: string; signedAt: Date } | undefined;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt: Date;
  passwordResetToken: String | undefined;
  passwordResetExpires: Date | undefined;
  childAuthToken: string | undefined;
  childAuthTokenExpires: Date | undefined;
  active: Boolean;
  correctPassword: Function;
  find: Function;
  changedPasswordAfter: Function;
  createPasswordResetToken: Function;
  createChildAuthToken: Function;
  populate: Function;
}

const userSchema = new Schema<IUser>(
  {
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
      validate: isMobilePhone,
    },
    email: {
      type: String,
      validate: isEmail,
      unique: true,
      sparse: true,
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
    parent: {
      type: Schema.Types.ObjectId,
      res: "User",
    },
    childAuthToken: String,
    childAuthTokenExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

userSchema.pre("save", async function (next) {
  if (this.passwordResetExpires || !this.isModified("password")) return next();

  if (!this.agreesToTerms)
    return next(new Error("You must agree to terms and conditions"));

  if (this.phoneNumber || this.phoneNumber !== "") {
    this.phoneNumber = this.phoneNumber.replaceAll(" ", "");
  }

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

userSchema.virtual("age").get(function () {
  if (!this.birthDate) return null;

  const birth = new Date(this.birthDate);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
});

userSchema.virtual("ageGroup").get(function () {
  if (!this.birthDate) return null;

  const birth = new Date(this.birthDate);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  const ageGroup =
    age <= 6
      ? "preschool"
      : age > 6 && age <= 18
      ? "school"
      : age > 18 && age <= 26
      ? "student"
      : "adult";

  return ageGroup;
});

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

userSchema.methods.createChildAuthToken = function () {
  const childAuthToken = randomBytes(32).toString("hex");

  this.childAuthToken = createHash("sha256")
    .update(childAuthToken)
    .digest("hex");
  this.childAuthTokenExpires = Date.now() + 10 * 60 * 1000;

  return childAuthToken;
};

const User = model<IUser>("User", userSchema);

export default User;
