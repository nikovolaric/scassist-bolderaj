import { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";

export const makePayment = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.body.articles.paymentMethod === "preInvoice") return next();
  const { amount, card } = req.body.paymentData;

  if (!amount || !card)
    return next(new AppError("Please provide all data!", 400));

  function generatePaymentBrand(): string | void {
    const cleaned = card.number.replace(/\s+/g, "");

    if (/^4[0-9]{6,}$/.test(cleaned)) return "VISA";
    if (
      /^(5[1-5][0-9]{4,}|2(2[2-9][0-9]{2,}|[3-6][0-9]{3,}|7[01][0-9]{2,}|720[0-9]{2,}))$/.test(
        cleaned
      )
    )
      return "MASTER";
    if (/^(34|37)/.test(cleaned)) return "AMEX";

    return next(new AppError("Card not found", 404));
  }

  const params = new URLSearchParams({
    entityId: "8a829418530df1d201531299e097175c",
    amount: amount,
    currency: "EUR",
    paymentType: "DB",
    paymentBrand: generatePaymentBrand() as string,
    "card.number": card.number,
    "card.holder": card.holder,
    "card.expiryMonth": card.expiryMonth,
    "card.expiryYear": card.expiryYear,
    "card.cvv": card.cvv,
  });

  const result = await fetch("https://eu-test.oppwa.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Bearer OGE4Mjk0MTg1MzBkZjFkMjAxNTMxMjk5ZTJjMTE3YWF8Tko5cHo4RXJYP0Y1OEpObmVMVz8=",
    },
    body: params,
  });

  if (!result.ok) return next(new AppError("Something went wrong", 500));

  const data = await result.json();

  if (data?.result?.code !== "000.100.110") {
    return next(new AppError("Plačilo ni bilo uspešno", 402));
  }

  next();
});

export const checkPayment = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { id } = req.params;

  const result = await fetch(
    `https://eu-test.oppwa.com/v1/checkouts/${id}/payment?entityId=8a829418530df1d201531299e097175c`,
    {
      method: "GET",
      headers: {
        Authorization:
          "Bearer OGE4Mjk0MTg1MzBkZjFkMjAxNTMxMjk5ZTJjMTE3YWF8Tko5cHo4RXJYP0Y1OEpObmVMVz8=",
      },
    }
  );

  if (!result.ok) return next(new AppError("Something went wrong", 500));

  const data = await result.json();

  res.status(201).json({
    status: "success",
    data,
  });
});
