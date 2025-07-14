import { NextFunction, Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import CashRegisterRecord from "../models/cashRegisterRecordModel";
import { deleteOne, getAll, getOne, updateOne } from "./handlerFactory";
import { addDays, parse } from "date-fns";

// export const getAllCashRegisterRecords = getAll(CashRegisterRecord);
export const getOneCashRegisterRecord = getOne(CashRegisterRecord, {
  path: "user",
  select: "firstName lastName email",
});
export const updateCashRegisterRecord = updateOne(CashRegisterRecord);
export const deleteCashRegisterRecord = deleteOne(CashRegisterRecord);

export const getAllCashRegisterRecords = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { date } = req.query;

  const cashRegister = await CashRegisterRecord.find({
    loginTime: {
      $gte: parse(date as string, "d.M.yyyy", new Date()),
      $lt: addDays(parse(date as string, "d.M.yyyy", new Date()), 1),
    },
  }).populate({ path: "user", select: "firstName lastName" });

  res.status(200).json({
    status: "success",
    results: cashRegister.length,
    cashRegister,
  });
});

const signToken = function (id: string) {
  return sign({ id }, process.env.JWT_SECRET_CASHREGISTER!, {
    expiresIn: 24 * 60 * 60 * 1000,
  });
};

const createSendToken = function (
  cashRegisterRecord: { _id: any },
  statusCode: number,
  res: Response,
  cookieName: string
) {
  const token = signToken(cashRegisterRecord._id);
  const cookieOptions: {
    expires: Date;
    httpOnly: boolean;
    sameSite: boolean;
    secure?: boolean;
    domain?: string;
  } = {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: true,
  };

  if (process.env.NODE_ENV === "production") {
    cookieOptions.secure = true;
    cookieOptions.domain = ".bolderaj.si";
  }

  res.cookie(cookieName, token, cookieOptions);

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

  const cr1 = req.cookies.cr1;
  const cr2 = req.cookies.cr2;
  const cr3 = req.cookies.cr3;
  const cr4 = req.cookies.cr4;

  function generateCookieName() {
    if (!cr1) return "cr1";
    if (!cr2) return "cr2";
    if (!cr3) return "cr3";
    if (!cr4) return "cr4";
    else return "cr5";
  }

  createSendToken(cashRegisterRecord, 201, res, generateCookieName());
});

export const getCashRegisterRecord = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const cookieNames = ["cr1", "cr2", "cr3", "cr4", "cr5"];
  let activeCashRegisterRecord = null;

  for (const cookieName of cookieNames) {
    const token = req.cookies[cookieName];
    if (!token) continue;

    const crInfo: any = verify(
      token,
      process.env.JWT_SECRET_CASHREGISTER as string
    );

    const cr = await CashRegisterRecord.findOne({
      _id: crInfo.id,
      user: req.user.id,
      logoutTime: { $exists: false }, // aktivna izmena
    });

    if (cr) {
      activeCashRegisterRecord = cr;
      break;
    }
  }

  if (!activeCashRegisterRecord) {
    return next(new AppError("No active cash register record found", 404));
  }

  res.status(200).json({
    status: "success",
    cashRegisterRecord: activeCashRegisterRecord,
  });
});

export const endCashRegisterRecord = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const cookieNames = ["cr1", "cr2", "cr3", "cr4", "cr5"];
  let matchedCookieName: string | null = null;
  let cashRegisterRecord = null;

  for (const cookieName of cookieNames) {
    const token = req.cookies[cookieName];
    if (!token) continue;

    const crInfo: any = verify(
      token,
      process.env.JWT_SECRET_CASHREGISTER as string
    );

    const record = await CashRegisterRecord.findById(crInfo.id);

    if (
      record &&
      ((record.user as any).id === req.user.id ||
        record.user.toString() === req.user.id)
    ) {
      matchedCookieName = cookieName;
      cashRegisterRecord = record;
      break;
    }
  }

  if (!cashRegisterRecord)
    return next(new AppError("No active cash register record found", 404));

  // Posodobi podatke
  cashRegisterRecord.endCashBalance = req.body.endCashBalance;
  cashRegisterRecord.endCreditCardBalance = req.body.endCreditCardBalance;
  cashRegisterRecord.logoutTime = new Date();

  await cashRegisterRecord.save({ validateBeforeSave: false });

  // Počisti samo ustrezni cookie
  if (matchedCookieName) {
    res.clearCookie(matchedCookieName);
    res.clearCookie("jwt");
  }

  res.status(200).json({
    status: "success",
    cashRegisterRecord,
  });
});

export const protectCR = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const cookieNames = ["cr1", "cr2", "cr3", "cr4", "cr5"];
  let currentCR = null;

  for (const name of cookieNames) {
    const token = req.cookies[name];
    if (!token) continue;

    try {
      const decoded: any = verify(token, process.env.JWT_SECRET_CASHREGISTER!);

      const cr = await CashRegisterRecord.findById(decoded.id);

      if (
        cr &&
        ((cr.user as any).id === req.user.id ||
          cr.user.toString() === req.user.id)
      ) {
        currentCR = cr;

        break;
      }
    } catch (err) {
      // Ignore invalid tokens
      continue;
    }
  }

  if (!currentCR) {
    return next(
      new AppError(
        "You are not logged in to any active cash register record.",
        401
      )
    );
  }
  req.cashRegister = currentCR;
  next();
});
