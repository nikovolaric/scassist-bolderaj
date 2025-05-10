import { NextFunction, Request, Response } from "express";
import Visit from "../models/visitModel.js";
import catchAsync from "../utils/catchAsync.js";
import { getAll } from "./handlerFactory.js";
import APIFeatures from "../utils/apiFeatures.js";
import AppError from "../utils/appError.js";

export const getAllVisits = getAll(Visit);

export const getMyVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const features = new APIFeatures(
    Visit.find({ user: req.user.id }).populate({
      path: "ticket",
      select: "name",
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const visits = await features.query;

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});

export const getMyChildVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const childId = req.params.id;

  if (
    req.user.parentOf.filter((el) => el.child.toString() === childId).length ===
    0
  )
    return next(new AppError("This is not your child", 403));

  const features = new APIFeatures(
    Visit.find({ user: childId }).populate({
      path: "ticket",
      select: "name",
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const visits = await features.query;

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});

export const getYearlyVisitsNo = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const year = req.params.year;

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const visits = await Visit.find({
    date: { $gte: startDate, $lte: endDate },
    user: req.user._id,
  });

  res.status(200).json({
    status: "success",
    results: visits.length,
  });
});
