import { NextFunction, Request, Response } from "express";
import Gift from "../models/giftModel";
import catchAsync from "../utils/catchAsync";
import { deleteOne, getOne } from "./handlerFactory";
import AppError from "../utils/appError";
import User from "../models/userModel";
import { generateRandomString } from "../utils/helpers";
import Ticket from "../models/ticketModel";
import Visit from "../models/visitModel";

export const getOneGift = getOne(Gift, {
  path: "article",
  select: "name ageGroup",
});

export const deleteGift = deleteOne(Gift);

export const getAllGifts = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { giftCode, expired, used, page, limit, ...query } = req.query;

  const isUsed = used === "true" ? true : false;

  const gifts = await Gift.find({
    ...query,
    ...(isUsed && { used: { $ne: isUsed } }),
    ...(!isUsed && { used: !isUsed }),
    ...(giftCode && { giftCode: { $regex: giftCode, $options: "i" } }),
    ...(expired
      ? { expires: { $lt: new Date() } }
      : { expires: { $gte: new Date() } }),
  })
    .populate({ path: "article", select: "name ageGroup" })
    .limit(Number(limit) || 50)
    .skip(Number(limit) * (Number(page) - 1) || 0)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: gifts.length,
    gifts,
  });
});

export const useGift = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const giftId = req.params.id;

  const gift = await Gift.findById(giftId).populate<{
    article: {
      name: {
        sl: string;
        en: string;
      };
      ageGroup: string[];
      type: string;
      visits: number;
      duration: number;
    };
  }>({
    path: "article",
    select: "ageGroup name type visits duration",
  });

  if (!gift) return next(new AppError("Gift not found.", 404));
  if (gift.used || new Date(gift.expires) < new Date())
    return next(new AppError("Gift already used or expired.", 400));

  const user = await User.findById(req.body.userId);

  if (!user) return next(new AppError("User not found.", 404));

  if (!user.ageGroup.some((el) => gift.article.ageGroup.includes(el)))
    return next(new AppError("User is in the wrong age group.", 400));

  if (gift.label !== "V")
    return next(new AppError("You can only use label V on this route.", 400));

  const { name, type, visits, duration } = gift.article;

  const ticketData: {
    name: { sl: string; en: string };
    type: string;
    used: boolean;
    duration?: number;
    visits?: number;
    visitsLeft?: number;
    usedOn?: Date;
    validUntil?: Date;
  } = {
    name,
    type,
    used: true,
  };

  if (visits) {
    ticketData.visits = visits;
    ticketData.visitsLeft = visits - 1;
  }

  if (duration) {
    ticketData.duration = duration;
  }

  if (type === "dnevna") {
    ticketData.usedOn = new Date();
    ticketData.validUntil = new Date();
  }

  const ticket = await Ticket.create(ticketData);

  const visitData = {
    user: user._id,
    ticket: ticket._id,
  };

  await Visit.create(visitData);

  gift.used = true;
  await gift.save({ validateBeforeSave: false });

  if (type !== "dnevna") {
    user.unusedTickets = [...user.unusedTickets, ticket._id];
    await user.save({ validateBeforeSave: false });
  }

  res.status(200).json({
    status: "success",
  });
});

export const generateGiftCodes = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  await Promise.all(
    Array.from({ length: req.body.quantity }).map(async () => {
      const data: any = {
        article: req.body.article,
        label: req.body.label,
        giftCode: generateRandomString(8),
      };

      if (req.body.expires) {
        data.expires = req.body.expires;
      }

      await Gift.create(data);
    })
  );

  res.status(200).json({
    status: "success",
  });
});
