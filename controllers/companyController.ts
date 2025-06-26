import { NextFunction, Request, Response } from "express";
import Company from "../models/companyModel";
import catchAsync from "../utils/catchAsync";
import { createOne, deleteOne, getOne, updateOne } from "./handlerFactory";
import AppError from "../utils/appError";
import APIFeatures from "../utils/apiFeatures";
import Ticket from "../models/ticketModel";
import Visit from "../models/visitModel";
import User from "../models/userModel";

export const getCompany = getOne(Company);
export const createCompany = createOne(Company);
export const updateCompany = updateOne(Company);
export const deleteCompany = deleteOne(Company);

export const getAllCompanies = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let filter = {};

  const { companyName, ...query } = req.query;

  const features = new APIFeatures(Company.find(filter), {
    ...query,
    ...(companyName && {
      companyName: { $regex: companyName, $options: "i" },
    }),
  })
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const companies = await features.query;

  res.status(200).json({
    status: "success",
    results: companies.length,
    companies,
  });
});

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

export const useCompanyTicket = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company does not exist", 404));

  for (const id of req.body.users) {
    const ticket = await Ticket.findById(company.unusedTickets[0]);

    if (!ticket) return next(new AppError("Ticket does not exist", 404));

    ticket.used = true;
    company.unusedTickets.shift();

    const newVisit = {
      user: id,
      ticket: ticket._id,
      company: company._id,
    };

    await Visit.create(newVisit);
    await ticket.save({ validateBeforeSave: false });
    await company.save({ validateBeforeSave: false });
  }

  res.status(201).json({
    status: "success",
  });
});

export const removeUser = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company does not exist", 404));

  const userId = req.params.userid;

  company.users = company.users.filter((user: any) => user.id !== userId);

  await company.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
  });
});

export const addUser = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company does not exist", 404));

  const user = await User.findById(req.params.userid);

  if (!user) return next(new AppError("User does not exist", 404));

  company.users.push(user._id);

  await company.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
  });
});
