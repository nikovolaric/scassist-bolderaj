import { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongoose";
import catchAsync from "../utils/catchAsync";
import Ticket from "../models/ticketModel";
import User from "../models/userModel";
import AppError from "../utils/appError";
import { deleteOne, getAll, getOne, updateOne } from "./handlerFactory";
import Visit from "../models/visitModel";
import Article from "../models/articleModel";
import Company from "../models/companyModel";

export const getOneTicket = getOne(Ticket, {
  path: "user",
  select: "firstName lastName email",
});
export const getAllTickets = getAll(Ticket);
export const updateTicket = updateOne(Ticket);
// export const deleteTicket = deleteOne(Ticket);

export const deleteTicket = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.body.user);

  if (!user) return next(new AppError("User not found.", 404));

  user.unusedTickets = user.unusedTickets.filter(
    (t) => t.toString() !== req.params.id
  );

  await user.save({ validateBeforeSave: false });

  const visits = await Visit.find({ ticket: req.params.id });

  if (visits.length === 0) {
    await Ticket.findByIdAndDelete(req.params.id);
  }

  res.status(204).json({
    status: "success",
  });
});

export const createTicket = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.body.user);

  if (!user)
    return next(new AppError("Can not create ticket without a user.", 400));

  const article = await Article.findById(req.body.article);

  if (!article) return next(new AppError("Article does not exist..", 400));

  const { name, type, morning, duration, visits } = article;

  const data = {
    name,
    type,
    morning,
    duration,
    visits,
    user: user._id,
  };

  const ticket = await Ticket.create(data);

  user.unusedTickets.push(ticket._id);

  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
    ticket,
  });
});

export const useTicket = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //preveri če je user vpisan v cash register
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError("Ticket not found", 404));
  if (ticket.used && ticket.type === "dnevna" && ticket.validUntil < new Date())
    return next(new AppError("Ticket is not valid", 400));

  if (ticket.morning && new Date().getHours() >= 14)
    return next(new AppError("This ticket can be used until 14.00", 403));

  const user = await User.findById(ticket.user);

  if (!user) return next(new AppError("User not found", 404));

  const newVisitData = {
    date: new Date(),
    user: user.id,
    ticket: ticket.id,
  };

  const visit = await Visit.create(newVisitData);

  if (ticket.type === "dnevna") {
    ticket.used = true;
    ticket.usedOn = new Date();
    ticket.validUntil = new Date();

    user.unusedTickets = user.unusedTickets.filter((t) => {
      return t.toString() !== ticket.id.toString();
    });
  }

  if (
    ticket.type === "terminska" &&
    ticket.validUntil.setHours(0, 0, 1) < new Date().setHours(0, 0, 0)
  ) {
    user.unusedTickets = user.unusedTickets.filter((t) => {
      return t.toString() !== ticket.id.toString();
    });

    await user.save({ validateBeforeSave: false });
    return next(new AppError("This ticket is not valid anymore.", 400));
  }

  if (ticket.type === "terminska" && !ticket.used) {
    ticket.validUntil = new Date(
      new Date().setDate(new Date().getDate() + ticket.duration)
    );
    ticket.used = true;
  }

  if (
    ticket.type === "paket" &&
    (!ticket.visitsLeft || ticket.validUntil < new Date())
  ) {
    user.unusedTickets = user.unusedTickets.filter((t) => {
      return t.toString() !== ticket.id.toString();
    });

    await user.save({ validateBeforeSave: false });
    return next(new AppError("This ticket is not valid anymore.", 400));
  }

  if (ticket.type === "paket") {
    if (!ticket.used) {
      ticket.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      ticket.used = true;
    }

    ticket.visitsLeft = ticket.visitsLeft - 1;
    if (ticket.visitsLeft === 0) {
      user.unusedTickets = user.unusedTickets.filter((t) => {
        return t.toString() !== ticket.id.toString();
      });
    }
  }

  await ticket.save({ validateBeforeSave: false });
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    visit,
  });
});

export const getMyValidTickets = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id).populate({
    path: "unusedTickets",
    select: "-__v -createdAt -user",
  });

  if (!user) return next(new AppError("User not found", 404));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validTickets = user.unusedTickets.filter((ticket: any) => {
    const validUntil = new Date(ticket.validUntil);
    validUntil.setHours(0, 0, 1, 0);
    return validUntil >= today;
  });

  if (validTickets.length !== user.unusedTickets.length) {
    user.unusedTickets = validTickets.map((t: any) => t._id);
    await user.save({ validateBeforeSave: false });
  }

  const unusedTickets = await Promise.all(
    user.unusedTickets.map(async (el: any) => {
      const count = await Visit.countDocuments({ ticket: el._id });

      return { ...el.toObject(), usedVisits: count };
    })
  );

  res.status(200).json({
    status: "success",
    results: unusedTickets.length,
    unusedTickets: unusedTickets.sort(
      (a: any, b: any) => b.updatedAt - a.updatedAt
    ),
  });
});

export const getChildValidTickets = catchAsync(async function (
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

  const child = await User.findById(childId).populate({
    path: "unusedTickets",
    select: "-__v -createdAt -user -used",
  });

  if (!child) return next(new AppError("User not found", 404));

  res.status(200).json({
    status: "success",
    results: child.unusedTickets.length,
    unusedTickets: child.unusedTickets.sort(
      (a: any, b: any) => b.updatedAt - a.updatedAt
    ),
  });
});

export const createTicketsForCompany = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company not found", 404));

  const article = await Article.findOne({ type: "dnevna", ageGroup: "adult" });

  if (!article) return next(new AppError("Article not found", 404));

  let tickets: ObjectId[] = [];

  await Promise.all(
    Array.from({ length: req.body.quantity }).map(async () => {
      const data = {
        type: article.type,
        company: company.id,
        name: article.name,
      };

      const ticket = await Ticket.create(data);

      if (!ticket) return next(new AppError("Something went wrong!", 500));

      tickets = [...tickets, ticket.id];
    })
  );

  company.unusedTickets = [...company.unusedTickets, ...tickets];
  await company.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
    company,
  });
});

export const deleteCompanyTickets = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company not found", 404));

  const deletedTickets = company.unusedTickets.slice(0, req.body.quantity);
  const rest = company.unusedTickets.slice(req.body.quantity);

  for (const ticket of deletedTickets) {
    await Ticket.findByIdAndDelete(ticket);
  }

  company.unusedTickets = rest;
  await company.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
  });
});
