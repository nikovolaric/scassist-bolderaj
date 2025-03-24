import { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import Ticket from "../models/ticketModel";
import User from "../models/userModel";
import { ObjectId } from "mongoose";
import { generateRandomString } from "../utils/helpers";
import Invoice from "../models/invoiceModel";
import AppError from "../utils/appError";
import { createOne, getAll, getOne } from "./handlerFactory";
import Visit from "../models/visitModel";
import Article from "../models/articleModel";
import Company from "../models/companyModel";

export const getOneTicket = getOne(Ticket, {
  path: "user",
  select: "firstName lastName email",
});
export const getAllTickets = getAll(Ticket);

export const useTicket = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //preveri če je user vpisan v cash register
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) return next(new AppError("Ticket not found", 404));
  if (
    (ticket.used &&
      (ticket.type === "dnevna" || ticket.type === "dopoldanska")) ||
    ticket.validUntil < new Date()
  )
    return next(new AppError("Ticket is not valid", 400));

  if (ticket.type === "dopoldanska" && new Date().getHours() >= 12)
    return next(new AppError("This ticket can be used until 12.00", 403));

  const user = await User.findById(ticket.user);

  if (!user) return next(new AppError("User not found", 404));

  const newVisitData = {
    date: new Date(),
    user: user.id,
    ticket: ticket.id,
  };

  const visit = await Visit.create(newVisitData);

  if (ticket.type === "dnevna" || ticket.type === "dopoldanska") {
    ticket.used = true;
    ticket.usedOn = new Date();
    ticket.validUntil = new Date();

    user.unusedTickets = user.unusedTickets.filter((t) => {
      return t.toString() !== ticket.id.toString();
    });

    user.usedTickets = [...user.usedTickets, ticket.id];
  }

  if (ticket.type === "terminska" && ticket.validUntil < new Date())
    return next(new AppError("This ticket is used", 400));

  if (ticket.type === "terminska") {
    ticket.validUntil = new Date(
      Date.now() + ticket.duration * 24 * 60 * 60 * 1000
    );
    ticket.canUseUntil = new Date(
      Date.now() + ticket.duration * 24 * 60 * 60 * 1000
    );
    ticket.used = true;

    if (ticket.validUntil < new Date()) {
      user.unusedTickets = user.unusedTickets.filter((t) => {
        return t.toString() !== ticket.id.toString();
      });

      user.usedTickets = [...user.usedTickets, ticket.id];
    }
  }

  if (ticket.type === "paket" && !ticket.visits)
    return next(new AppError("This ticket is used", 400));

  if (ticket.type === "paket") {
    ticket.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    ticket.canUseUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    ticket.visits = ticket.visits - 1;
    ticket.used = true;
    if (ticket.visits === 0) {
      user.unusedTickets = user.unusedTickets.filter((t) => {
        return t.toString() !== ticket.id.toString();
      });

      user.usedTickets = [...user.usedTickets, ticket.id];
    }
  }

  user.visits = [...user.visits, visit.id];

  await ticket.save({ validateBeforeSave: false });
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    visit,
  });
});

export const useCuponTicket = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ticket = await Ticket.findOne({ giftCode: req.body.giftCode });

  if (!ticket) return next(new AppError("Ticket not found", 404));

  const user = await User.findById(req.params.id);

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

    user.usedTickets = [...user.usedTickets, ticket.id];
  }

  if (ticket.type === "terminska" && ticket.validUntil < new Date())
    return next(new AppError("This ticket is used", 400));

  if (ticket.type === "terminska") {
    ticket.validUntil = new Date(
      Date.now() + ticket.duration * 24 * 60 * 60 * 1000
    );
    ticket.canUseUntil = new Date(
      Date.now() + ticket.duration * 24 * 60 * 60 * 1000
    );
    ticket.used = true;

    if (ticket.validUntil < new Date()) {
      user.unusedTickets = user.unusedTickets.filter((t) => {
        return t.toString() !== ticket.id.toString();
      });

      user.usedTickets = [...user.usedTickets, ticket.id];
    }
  }

  if (ticket.type === "paket" && !ticket.visits)
    return next(new AppError("This ticket is used", 400));

  if (ticket.type === "paket") {
    ticket.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    ticket.canUseUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    ticket.visits = ticket.visits - 1;
    ticket.used = true;
    if (ticket.visits === 0) {
      user.unusedTickets = user.unusedTickets.filter((t) => {
        return t.toString() !== ticket.id.toString();
      });

      user.usedTickets = [...user.usedTickets, ticket.id];
    }
  }

  user.visits = [...user.visits, visit.id];

  await ticket.save({ validateBeforeSave: false });
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    user,
  });
});

export const getMyValidTickets = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id).populate({
    path: "unusedTickets",
    select: "type validUntil canUseUntil",
  });

  if (!user) return next(new AppError("User not found", 404));

  res.status(200).json({
    status: "success",
    unusedTickets: user.unusedTickets,
  });
});

export const getMyUsedTickets = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id).populate({
    path: "usedTickets",
    select: "type usedOn",
  });

  if (!user) return next(new AppError("User not found", 404));

  res.status(200).json({
    status: "success",
    usedTickets: user.usedTickets,
  });
});

export const createTicketsForCompany = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.id);

  if (!company) return next(new AppError("Company not found", 404));

  const article = await Article.findById(req.body.articleId);

  if (!article) return next(new AppError("Article not found", 404));

  let tickets: ObjectId[] = [];

  await Promise.all(
    Array.from({ length: req.body.quantity }).map(async () => {
      const data = {
        type: article.type,
        company: company.id,
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
