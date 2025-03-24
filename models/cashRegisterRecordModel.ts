import { Schema, model } from "mongoose";

interface ICashRegisterRecord {
  user: Schema.Types.ObjectId;
  loginTime: Date;
  startCashBalance: number;
  startCreditCardBalance: number;
  endCashBalance: number;
  endCreditCardBalance: number;
  logoutTime: Date;
  cashBalanceDifference: number;
  creditCardBalanceDifference: number;
}

const cashRegisterRecordSchema = new Schema<ICashRegisterRecord>(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: [true, "A cash register record must have a user"],
    },
    loginTime: {
      type: Date,
      required: [true, "A cash register record must have a login time"],
    },
    startCashBalance: {
      type: Number,
      required: [true, "A cash register record must have a start cash balance"],
    },
    startCreditCardBalance: { type: Number, default: 0 },
    endCashBalance: Number,
    endCreditCardBalance: Number,
    logoutTime: Date,
    cashBalanceDifference: Number,
    creditCardBalanceDifference: Number,
  },
  { timestamps: true }
);

cashRegisterRecordSchema.pre("save", function (next) {
  if (
    this.isNew ||
    !this.isModified("endCashBalance") ||
    !this.isModified("endCreditCardBalance")
  )
    return next();

  this.cashBalanceDifference = this.endCashBalance - this.startCashBalance;

  this.creditCardBalanceDifference =
    this.endCreditCardBalance - this.startCreditCardBalance;

  next();
});

cashRegisterRecordSchema.pre(/^find/, function (next) {
  //@ts-ignore
  this.populate({
    path: "user",
    select: "firstName lastName",
  });

  next();
});

const CashRegisterRecord = model<ICashRegisterRecord>(
  "CashRegisterRecord",
  cashRegisterRecordSchema
);

export default CashRegisterRecord;
