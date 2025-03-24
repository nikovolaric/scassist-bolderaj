import { NextFunction, Request, Response } from "express";
import Company from "../models/companyModel";
import catchAsync from "../utils/catchAsync";
import { createOne, getAll, getOne } from "./handlerFactory";
import AppError from "../utils/appError";

export const getAllCompanies = getAll(Company);
export const getCompany = getOne(Company);
export const createCompany = createOne(Company);

export const addUsersToCompany = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company does not exist", 404));

  company.users = req.body.users;
  await company.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    company,
  });
});
