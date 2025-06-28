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
    entityId: "8ac9a4c89662aaee019666c30a041667",
    amount: amount,
    currency: "EUR",
    paymentType: "DB",
    integrity: "true",
  });

  const result = await fetch(`https://eu-prod.oppwa.com/v1/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Bearer OGFjOWE0Yzg5NjYyYWFlZTAxOTY2NmMxMGVlOTE2NGR8QGQ0b1dnS2IrRW9YJTVyP049I3U=",
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
  if (req.body.articles.paymentMethod !== "online") {
    return next();
  }

  const paymentRes = await fetch(
    `https://eu-prod.oppwa.com/v1/checkouts/${req.body.checkoutId}/payment?entityId=8ac9a4c89662aaee019666c30a041667`,
    {
      method: "GET",
      headers: {
        Authorization:
          "Bearer OGFjOWE0Yzg5NjYyYWFlZTAxOTY2NmMxMGVlOTE2NGR8QGQ0b1dnS2IrRW9YJTVyP049I3U=",
      },
    }
  );

  const paymentData: any = await paymentRes.json();

  if (!paymentRes.ok) return next(new AppError("Something went wrong!", 500));

  if (paymentData.result.code !== "000.100.110")
    return next(new AppError("Something went wrong!", 500));

  next();
});
