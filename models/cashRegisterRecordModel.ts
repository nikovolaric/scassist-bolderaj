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
  hoursWorked: number;
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
    hoursWorked: Number,
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

  this.cashBalanceDifference = parseFloat(
    (this.endCashBalance - this.startCashBalance).toFixed(2)
  );

  this.creditCardBalanceDifference = parseFloat(
    (this.endCreditCardBalance - this.startCreditCardBalance).toFixed(2)
  );

  if (this.logoutTime && this.loginTime) {
    this.hoursWorked =
      (this.logoutTime.getTime() - this.loginTime.getTime()) / (1000 * 60 * 60);
  }
  
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
