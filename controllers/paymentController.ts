import { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";

export const createSession = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const amount = req.params.amount;

  if (!amount) return next(new AppError("Please provide the amount", 400));

  const params = new URLSearchParams({
    entityId: process.env.HOBEX_ENTITYID as string,
    amount: amount,
    currency: "EUR",
    paymentType: "DB",
    integrity: "true",
  });

  const result = await fetch(`${process.env.HOBEX_URL}/v1/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${process.env.HOBEX_BEARER as string}`,
    },
    body: params,
  });

  const data = await result.json();

  if (!result.ok) return next(new AppError("Something went wrong", 404));

  res.status(200).json({
    status: "success",
    data,
  });
});

export const checkPayment = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.body.paymentMethod !== "online") {
    return next();
  }

  const paymentRes = await fetch(
    `${process.env.HOBEX_URL}v1/checkouts/${
      req.body.checkoutId
    }/payment?entityId=${process.env.HOBEX_ENTITYID as string}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.HOBEX_BEARER as string}`,
      },
    }
  );

  const paymentData: any = await paymentRes.json();

  if (!paymentRes.ok) return next(new AppError("Something went wrong!", 500));

  const pattern = /^(000\.000\.|000\.100\.1|000\.[36]|000\.400\.[1][12]0)/;

  if (!pattern.test(paymentData.result.code)) {
    return next(new AppError("Something went wrong!", 500));
  }

  next();
});
