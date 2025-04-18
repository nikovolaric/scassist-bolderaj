import { NextFunction, Request, Response } from "express";
import Article from "../models/articleModel";
import catchAsync from "../utils/catchAsync";
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from "./handlerFactory";
import APIFeatures from "../utils/apiFeatures";
import Class from "../models/classModel";
import AppError from "../utils/appError";
import User from "../models/userModel";
import Invoice from "../models/invoiceModel";
import { generateRandomString } from "../utils/helpers";
import { ObjectId } from "mongoose";
import Ticket from "../models/ticketModel";
import { sendCode } from "../utils/email";
import {
  bussinesPremises,
  connectWithFURS,
  generateJSONInvoice,
} from "../utils/createJSONInvoice";
import Visit from "../models/visitModel";
import { makePayment } from "./paymentController";

export const createArticle = createOne(Article);
export const updateArticle = updateOne(Article);
export const deleteArticle = deleteOne(Article);

export const getAllArticles = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let filter = {};

  const features = new APIFeatures(Article.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const articles = await features.query;

  // const articles = await Promise.all(
  //   doc.map(async (el: any) => {
  //     if (el.class.length>0) {
  //       const currentClass = await Class.findById(el.class);

  //       if (!currentClass) return next(new AppError("Class not found", 404));

  //       const article = await Article.findById(el._id);

  //       if (!article) return next(new AppError("Article not found", 404));

  //       const newDates = currentClass.dates.filter(
  //         (date: Date) => date > new Date()
  //       );

  //       if (newDates.length !== currentClass.dates.length) {
  //         currentClass.dates = newDates;

  //         article.price =
  //           (article.price / currentClass.totalClasses) *
  //           currentClass.dates.length;

  //         await currentClass.save({ validateBeforeSave: false });
  //         await article.save({ validateBeforeSave: false });

  //         el.price = article.price;
  //         el.priceDDV = article.priceDDV;
  //         return el;
  //       }
  //     }

  //     return el;
  //   })
  // );

  res.status(200).json({
    status: "success",
    results: articles.length,
    articles,
  });
});

export const getAllVisibleArticles = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let filter = { hidden: { $ne: true } };

  const features = new APIFeatures(Article.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const articles = await features.query;

  res.status(200).json({
    status: "success",
    results: articles.length,
    articles,
  });
});

export const getOneArticle = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const article = await Article.findById(req.params.id);

  if (!article) return next(new AppError("Article not found", 404));

  res.status(200).json({
    status: "success",
    article,
  });
});

export const buyArticlesOnline = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id);

  if (!user) return next(new AppError("User not found", 404));

  const lastInvoice = await Invoice.findOne().sort({
    "invoiceData.invoiceNo": -1,
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: { articleId: string; quantity: number; gift: boolean }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const articleToBuy = {
          article,
          quantity: el.quantity,
          gift: el.gift,
        };

        return articleToBuy;
      }
    )
  );

  cart.forEach((el) => {
    if (el.article.label !== "V")
      return next(new AppError("You can only buy tickets on this route", 400));
  });

  for (const el of cart) {
    if (el.article.label === "V") {
      let tickets: ObjectId[] = [];
      if (!el.gift) {
        await Promise.all(
          Array.from({ length: el.quantity }).map(async () => {
            const data = {
              name: el.article.name,
              type: el.article.type,
              duration: el.article.duration,
              visits: el.article.visits,
              morning: el.article.morning,
              user: req.user.id,
            };
            const ticket = await Ticket.create(data);

            if (!ticket)
              return next(new AppError("Something went wrong!", 500));

            tickets = [...tickets, ticket.id];
          })
        );

        const unusedTickets = [...user.unusedTickets, ...tickets];
        await User.findByIdAndUpdate(user.id, { unusedTickets: unusedTickets });
      }

      if (el.gift) {
        const data = {
          name: el.article.name,
          type: el.article.type,
          duration: el.article.duration,
          visits: el.article.visits,
          giftCode: generateRandomString(10),
        };
        const ticket = await Ticket.create(data);

        if (!ticket) return next(new AppError("Something went wrong!", 500));

        await sendCode({ firstName: user.firstName, code: ticket.giftCode });
      }
    }
  }

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount: el.article.price * el.article.taxRate * el.quantity,
    };
    return tax;
  });
  const totalPrice = cart.reduce(
    (c, el) => c + el.article.priceDDV * el.quantity,
    0
  );

  const invoiceData = {
    dateTime: new Date(),
    issueDateTime: new Date(),
    numberingStructure: "C",
    businessPremiseID: "PC1",
    electronicDeviceID: "BO",
    invoiceNumber: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    invoiceAmount: totalPrice,
    paymentAmount: totalPrice,
    taxes,
    operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const soldItems = cart.map((el) => {
    const item = {
      taxRate: el.article.taxRate,
      taxableAmount: el.article.price.toFixed(2),
      quantity: el.quantity,
      item: el.article.name,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: user.id,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
    },
    soldItems,
    paymentMethod: "online",
    ZOI,
    EOR,
  };

  await Invoice.create(invoiceDataToSave);

  res.status(200).json({
    status: "success",
    cart,
  });
});

export const buyArticlesOnlineForChild = catchAsync(async function (
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

  const user = await User.findById(childId);

  if (!user) return next(new AppError("User not found", 404));

  const lastInvoice = await Invoice.findOne().sort({
    "invoiceData.invoiceNo": -1,
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: { articleId: string; quantity: number }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const articleToBuy = { article, quantity: el.quantity };

        return articleToBuy;
      }
    )
  );

  cart.forEach((el) => {
    if (el.article.label !== "V")
      return next(new AppError("You can only buy tickets on this route", 400));
  });

  for (const el of cart) {
    if (el.article.label === "V") {
      let tickets: ObjectId[] = [];

      await Promise.all(
        Array.from({ length: el.quantity }).map(async () => {
          const data = {
            name: el.article.name,
            type: el.article.type,
            duration: el.article.duration,
            visits: el.article.visits,
            user: user.id,
          };
          const ticket = await Ticket.create(data);

          if (!ticket) return next(new AppError("Something went wrong!", 500));

          tickets = [...tickets, ticket.id];
        })
      );

      user.unusedTickets = [...user.unusedTickets, ...tickets];
      await user.save({ validateBeforeSave: false });
    }
  }

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount: el.article.price * el.article.taxRate * el.quantity,
    };
    return tax;
  });
  const totalPrice = cart.reduce(
    (c, el) => c + el.article.priceDDV * el.quantity,
    0
  );

  const invoiceData = {
    dateTime: new Date(),
    issueDateTime: new Date(),
    numberingStructure: "C",
    businessPremiseID: "PC1",
    electronicDeviceID: "BO",
    invoiceNumber: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    invoiceAmount: totalPrice,
    paymentAmount: totalPrice,
    taxes,
    operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const soldItems = cart.map((el) => {
    const item = {
      taxRate: el.article.taxRate,
      taxableAmount: el.article.price.toFixed(2),
      quantity: el.quantity,
      item: el.article.name,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: req.user.id,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
    },
    soldItems,
    paymentMethod: "online",
    ZOI,
    EOR,
  };

  await Invoice.create(invoiceDataToSave);

  res.status(200).json({
    status: "success",
    cart,
  });
});

export const buyArticlesInPerson = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //preveri vpis v blagajno in ip

  const user = await User.findById(req.params.id);

  if (!user) return next(new AppError("User not found", 404));

  if (!req.body.paymentMethod)
    return next(new AppError("Please provide payment method!", 400));

  const lastInvoice = await Invoice.findOne().sort({
    "invoiceData.invoiceNo": -1,
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: {
        articleId: string;
        quantity: number;
        gift: boolean;
        useNow: boolean;
        otherId: string[];
      }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const articleToBuy = {
          article,
          quantity: el.otherId ? el.otherId.length : el.quantity,
          gift: el.gift,
          useNow: el.useNow,
          otherId: el.otherId,
        };

        return articleToBuy;
      }
    )
  );

  cart.forEach(async (el: any) => {
    if (el.article.label === "V") {
      let tickets: ObjectId[] = [];
      if (!el.gift && !el.useNow) {
        await Promise.all(
          Array.from({ length: el.quantity }).map(async () => {
            const data = {
              name: el.article.name,
              type: el.article.type,
              duration: el.article.duration,
              visits: el.article.visits,
              user: req.user.id,
            };
            const ticket = await Ticket.create(data);

            if (!ticket)
              return next(new AppError("Something went wrong!", 500));

            tickets = [...tickets, ticket.id];
          })
        );

        const unusedTickets = [...user.unusedTickets, ...tickets];
        await User.findByIdAndUpdate(user.id, { unusedTickets: unusedTickets });
      }

      if (el.gift && !el.useNow) {
        const data = {
          name: el.article.name,
          type: el.article.type,
          duration: el.article.duration,
          visits: el.article.visits,
          giftCode: generateRandomString(10),
        };
        const ticket = await Ticket.create(data);

        if (!ticket) return next(new AppError("Something went wrong!", 500));

        await sendCode({ firstName: user.firstName, code: ticket.giftCode });
      }

      if (el.useNow && !el.gift) {
        await Promise.all(
          Array.from({ length: el.quantity }).map(async () => {
            const data = {
              name: el.article.name,
              type: el.article.type,
              duration: el.article.duration,
              visits: el.article.visits,
              user: req.user.id,
              used: true,
            };

            const ticket = await Ticket.create(data);

            if (!ticket)
              return next(new AppError("Something went wrong!", 500));

            tickets = [...tickets, ticket.id];
          })
        );

        const visit = await Visit.create({
          date: new Date(),
          user: user.id,
          ticket: tickets[0],
        });

        if (!visit) return next(new AppError("Something went wrong!", 500));

        const visits = [...user.visits, visit.id];
        const unusedTickets = [...user.unusedTickets, ...tickets];
        await User.findByIdAndUpdate(user.id, { unusedTickets, visits });
      }

      if (!el.gift && el.otherId) {
        el.otherId.forEach(async (id: string) => {
          const otherUser = await User.findById(id);
          if (!otherUser) return next(new AppError("User not found", 404));

          let otherUserTickets: ObjectId[] = [];
          let visit: string = "";

          await Promise.all(
            Array.from({ length: 1 }).map(async () => {
              const data = {
                name: el.article.name,
                type: el.article.type,
                duration: el.article.duration,
                visits: el.article.visits,
                user: id,
                used: true,
              };
              const ticket = await Ticket.create(data);

              if (!ticket)
                return next(new AppError("Something went wrong!", 500));

              const newVisit = await Visit.create({
                date: new Date(),
                user: id,
                ticket: ticket.id,
              });

              otherUserTickets = [...otherUserTickets, ticket.id];
              visit = newVisit.id;
            })
          );

          const usedTickets = [...otherUser.usedTickets, ...otherUserTickets];
          const visits = [...otherUser.visits, visit];
          await User.findByIdAndUpdate(otherUser.id, { usedTickets, visits });
        });
      }
    }

    if (el.article.label === "T") {
      const currentClass = await Class.findById(el.article.class);

      if (!currentClass) return next(new AppError("Class not found", 404));

      if (
        currentClass.full ||
        currentClass.students.length >= currentClass.maxStudents
      )
        return next(new AppError("Class is full", 400));

      if (
        currentClass.students.map((student) => student.student === user._id)
          .length > 0
      )
        return next(
          new AppError("You are already signed up for this class", 400)
        );

      const students = [
        ...currentClass.students,
        {
          student: user._id,
          attendance: [],
        },
      ];

      if (students.length >= currentClass.maxStudents) {
        const full = true;
        await Class.findByIdAndUpdate(currentClass.id, { students, full });
      } else {
        await Class.findByIdAndUpdate(currentClass.id, { students });
      }
    }
  });

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount: el.article.price * el.article.taxRate * el.quantity,
    };
    return tax;
  });
  const totalPrice = cart.reduce(
    (c, el) => c + el.article.priceDDV * el.quantity,
    0
  );

  const invoiceData = {
    dateTime: new Date(),
    issueDateTime: new Date(),
    numberingStructure: "C",
    businessPremiseID: "PC1",
    electronicDeviceID: "BLAG1",
    invoiceNumber: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    invoiceAmount: totalPrice,
    paymentAmount: totalPrice,
    taxes,
    operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const soldItems = cart.map((el) => {
    const item = {
      taxRate: el.article.taxRate,
      taxableAmount: el.article.price.toFixed(2),
      quantity: el.quantity,
      item: el.article.name,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: user.id,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
    },
    soldItems,
    paymentMethod: req.body.paymentMethod,
    issuer: req.user.id,
    ZOI,
    EOR,
  };

  await Invoice.create(invoiceDataToSave);

  res.status(200).json({
    status: "success",
    cart,
  });
});

export const registerPremise = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  await bussinesPremises();

  res.status(200).json({
    status: "success",
  });
});
