import { NextFunction, Request, Response } from "express";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import APIFeatures from "../utils/apiFeatures";

export const deleteOne = (model: any) =>
  catchAsync(async function (req: Request, res: Response, next: NextFunction) {
    const doc = await model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

export const updateOne = (model: any) =>
  catchAsync(async function (req: Request, res: Response, next: NextFunction) {
    const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }

    res.status(200).json({
      status: "success",
      data: doc,
    });
  });

export const createOne = (model: any) =>
  catchAsync(async function (req: Request, res: Response, next: NextFunction) {
    const doc = await model.create(req.body);

    res.status(201).json({
      status: "success",
      data: doc,
    });
  });

export const getOne = (model: any, popOptions?: any) =>
  catchAsync(async function (req: Request, res: Response, next: NextFunction) {
    let query = model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError("No document found with that ID", 404));
    }

    res.status(200).json({
      status: "success",
      data: doc,
    });
  });

export const getAll = (model: any) =>
  catchAsync(async function (req: Request, res: Response, next: NextFunction) {
    let filter = {};

    const features = new APIFeatures(model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const doc = await features.query;

    res.status(200).json({
      status: "success",
      results: doc.length,
      data: doc,
    });
  });
