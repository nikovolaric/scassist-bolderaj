import { NextFunction, Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import CashRegisterRecord from "../models/cashRegisterRecordModel";
import { deleteOne, getAll, getOne, updateOne } from "./handlerFactory";

export const getAllCashRegisterRecords = getAll(CashRegisterRecord);
export const getOneCashRegisterRecord = getOne(CashRegisterRecord, {
  path: "user",
  select: "firstName lastName email",
});
export const updateCashRegisterRecord = updateOne(CashRegisterRecord);
export const deleteCashRegisterRecord = deleteOne(CashRegisterRecord);

const signToken = function (id: string) {
  return sign({ id }, process.env.JWT_SECRET_CASHREGISTER!, {
    expiresIn: Number(process.env.JWT_EXPIRES_IN) * 24 * 60 * 60,
  });
};

const createSendToken = function (
  cashRegisterRecord: { _id: any },
  statusCode: number,
  res: Response
) {
  const token = signToken(cashRegisterRecord._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() +
        Number(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  // if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res.cookie("cashRegister", token, cookieOptions);

  res.status(statusCode).json({
    status: "success",
    token,
    cashRegisterRecord,
  });
};

export const startCashRegisterRecord = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user;

  if (!user) return next(new AppError("User not found", 404));

  if (!user.role.includes("employee") && !user.role.includes("admin"))
    return next(
      new AppError("You are not allowed to start a cash register record", 403)
    );

  const cashRegisterRecordData = {
    user: user.id,
    loginTime: new Date(),
    startCashBalance: req.body.startCashBalance,
    startCreditCardBalance: req.body.startCreditCardBalance,
  };

  const cashRegisterRecord = await CashRegisterRecord.create(
    cashRegisterRecordData
  );

  createSendToken(cashRegisterRecord, 201, res);
});

export const endCashRegisterRecord = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const cashRegisterRecordJWT = req.headers.cookie
    ?.split(";")[0]
    .split("=")[1] as string;

  const decoded: any = verify(
    cashRegisterRecordJWT,
    process.env.JWT_SECRET_CASHREGISTER!
  );

  const cashRegisterRecord = await CashRegisterRecord.findById(decoded.id);

  if (!cashRegisterRecord)
    return next(new AppError("Cash register record not found", 404));

  if (req.user.id !== cashRegisterRecord.user.toString())
    return next(
      new AppError("You are not allowed to end this cash register record", 403)
    );

  cashRegisterRecord.endCashBalance = req.body.endCashBalance;
  cashRegisterRecord.endCreditCardBalance = req.body.endCreditCardBalance;
  cashRegisterRecord.logoutTime = new Date();

  await cashRegisterRecord.save({ validateBeforeSave: false });

  res.cookie("cashRegister", {
    expires: new Date(Date.now() + 1),
  });

  res.status(200).json({
    status: "success",
    cashRegisterRecord,
  });
});
