import { NextFunction, Request, Response } from "express";
import Visit from "../models/visitModel";
import catchAsync from "../utils/catchAsync";
import { getAll } from "./handlerFactory";

export const getAllVisits = getAll(Visit);

export const getMyVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const visits = await Visit.find({ user: req.user.id });

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});
