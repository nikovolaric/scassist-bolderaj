import { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";

export const pay = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.body.articles.paymentMethod === "preInvoice") return next();
  const { amount, card } = req.body.paymentData;

  if (!amount || !card)
    return next(new AppError("Please provide all data!", 400));

  const checkoutData = await createCheckoutsession(amount);

  if (checkoutData instanceof Error)
    return next(new AppError("Plačilo ni bilo uspešno", 500));

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
    paymentBrand: generatePaymentBrand() as string,
    "card.number": card.number,
    "card.holder": card.holder,
    "card.expiryMonth": card.expiryMonth,
    "card.expiryYear": card.expiryYear,
    "card.cvv": card.cvv,
  });

  const result = await fetch(
    `https://eu-test.oppwa.com/v1/checkouts/${checkoutData.id}/payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Bearer OGE4Mjk0MTg1MzBkZjFkMjAxNTMxMjk5ZTJjMTE3YWF8Tko5cHo4RXJYP0Y1OEpObmVMVz8=",
      },
      body: params,
    }
  );

  if (!result.ok) return next(new AppError("Something went wrong", 500));

  res.locals.checkoutId = checkoutData.id;

  next();
});

const createCheckoutsession = async function (amount: string) {
  try {
    const params = new URLSearchParams({
      entityId: "8a829418530df1d201531299e097175c",
      amount: amount,
      currency: "EUR",
      paymentType: "DB",
      integrity: "true",
    });

    const result = await fetch(`https://eu-test.oppwa.com/v1/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Bearer OGE4Mjk0MTg1MzBkZjFkMjAxNTMxMjk5ZTJjMTE3YWF8Tko5cHo4RXJYP0Y1OEpObmVMVz8=",
      },
      body: params,
    });

    const data = await result.json();

    if (!result.ok) throw data;

    return data;
  } catch (error) {
    return error as Error;
  }
};

export const checkPayment = async function (checkoutId: string) {
  try {
    const paymentRes = await fetch(
      `https://eu-test.oppwa.com/v1/checkouts/${checkoutId}/payment?entityId=8a829418530df1d201531299e097175c`,
      {
        method: "GET",
        headers: {
          Authorization:
            "Bearer OGE4Mjk0MTg1MzBkZjFkMjAxNTMxMjk5ZTJjMTE3YWF8Tko5cHo4RXJYP0Y1OEpObmVMVz8=",
        },
      }
    );

    const paymentData = await paymentRes.json();
    console.log(paymentData);
    console.log(paymentData.result.parameterErrors);

    if (!paymentRes.ok) throw paymentData;

    return paymentData;
  } catch (error) {
    console.error(error);
    return error as Error;
  }
};
