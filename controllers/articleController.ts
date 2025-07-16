import { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongoose";
import Article from "../models/articleModel";
import catchAsync from "../utils/catchAsync";
import { createOne, deleteOne, updateOne } from "./handlerFactory";
import APIFeatures from "../utils/apiFeatures";
import Class from "../models/classModel";
import AppError from "../utils/appError";
import User from "../models/userModel";
import Invoice from "../models/invoiceModel";
import Gift from "../models/giftModel";
import { generateRandomString } from "../utils/helpers";
import Ticket from "../models/ticketModel";
import { sendCode, sendInvoice } from "../utils/email";
import {
  connectWithFURS,
  generateJSONInvoice,
} from "../utils/createJSONInvoice";
import Visit from "../models/visitModel";

export const createArticle = createOne(Article);
export const updateArticle = updateOne(Article);
export const deleteArticle = deleteOne(Article);

export const getAllArticles = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let filter = {};

  const { name, ...query } = req.query;

  const features = new APIFeatures(Article.find(filter), {
    ...query,
    ...(name && {
      "name.sl": { $regex: name, $options: "i" },
    }),
  })
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

export const getAllVisibleArticlesUsers = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let filter = { hiddenUsers: { $ne: true } };

  const { name, ...query } = req.query;

  const features = new APIFeatures(Article.find(filter), {
    ...query,
    ...(name && {
      "name.sl": { $regex: name, $options: "i" },
    }),
  })
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

export const getAllVisibleArticlesReception = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let filter = { hiddenReception: { $ne: true } };

  const { name, ...query } = req.query;

  const features = new APIFeatures(Article.find(filter), {
    ...query,
    ...(name && {
      "name.sl": { $regex: name, $options: "i" },
    }),
  })
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

export const getAllGiftArticles = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ageGroup = req.params.agegroup;

  const articles = await Article.find({
    gift: true,
    ageGroup,
    label: req.query.label,
  }).sort({ type: 1 });

  if (!articles) return next(new AppError("Article not found!", 404));

  res.status(200).json({
    status: "success",
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

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAGO",
  }).sort({
    "invoiceData.invoiceNo": -1,
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: { articleId: string; quantity: number }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const articleToBuy = {
          article,
          quantity: el.quantity,
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

      for (let i = 0; i < el.quantity; i++) {
        const data = {
          name: el.article.name,
          type: el.article.type,
          duration: el.article.duration,
          visits: el.article.visits ?? undefined,
          morning: el.article.morning,
          validUntil:
            Date.now() + 1000 * 60 * 60 * 24 * el.article.activationDuration ||
            Date.now() + 1000 * 60 * 60 * 24 * 365,
          user: req.user.id,
        };

        const ticket = await Ticket.create(data);

        if (!ticket) return next(new AppError("Something went wrong!", 500));

        tickets = [...tickets, ticket.id];
      }

      const unusedTickets = [...user.unusedTickets, ...tickets];
      await User.findByIdAndUpdate(user.id, { unusedTickets: unusedTickets });
    }
  }

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount:
        parseFloat((el.article.priceDDV - el.article.price).toFixed(2)) *
        el.quantity,
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
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: "BLAGO",
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
      amountWithTax: el.article.priceDDV,
      quantity: el.quantity,
      item: el.article.name.sl,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: user.id,
    company: req.body.company,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
      invoiceNo: lastInvoice
        ? Number(lastInvoice.invoiceData.invoiceNo) + 1
        : 1,
    },
    soldItems,
    paymentMethod: req.body.paymentMethod,
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(invoiceDataToSave);

  await invoice.populate({
    path: "buyer issuer",
    select:
      "email firstName lastName phoneNumber invoiceNickname postalCode city address",
  });

  const buyer = invoice.buyer as any;

  const mailOptions = {
    email: invoice.buyer ? buyer.email : invoice.recepient.email,
    invoiceNumber: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    name: invoice.company.name
      ? invoice.company.name
      : invoice.buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    companyName: invoice.company.name,
    taxNumber: invoice.company.taxNumber,
    address: invoice.company.address
      ? invoice.company.address
      : invoice.buyer
      ? buyer.address
      : invoice.recepient.address,
    postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : invoice.buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    city: invoice.company.city
      ? invoice.company.city
      : invoice.buyer
      ? buyer.city
      : invoice.recepient.city,
    invoiceDate: invoice.invoiceDate,
    invoiceCompletionDate: invoice.serviceCompletionDate,
    reference: invoice.reference,
    cashier: invoice.issuerNickname ? invoice.issuerNickname : "Default",
    dueDate: invoice.paymentDueDate,
    paymentMethod: invoice.paymentMethod,
    items: invoice.soldItems,
    totalAmount: invoice.totalAmount,
    totalTaxAmount: invoice.totalAmount - invoice.totalTaxableAmount,
    EOR: invoice.EOR,
    ZOI: invoice.ZOI,
  };

  await sendInvoice(mailOptions);

  res.status(200).json({
    status: "success",
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

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAGO",
  }).sort({
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

      for (let i = 0; i < el.quantity; i++) {
        const data = {
          name: el.article.name,
          type: el.article.type,
          duration: el.article.duration,
          visits: el.article.visits ?? undefined,
          morning: el.article.morning,
          validUntil:
            Date.now() + 1000 * 60 * 60 * 24 * el.article.activationDuration ||
            Date.now() + 1000 * 60 * 60 * 24 * 365,
          user: user.id,
        };
        const ticket = await Ticket.create(data);

        if (!ticket) return next(new AppError("Something went wrong!", 500));

        tickets = [...tickets, ticket.id];
      }

      const unusedTickets = [...user.unusedTickets, ...tickets];
      await User.findByIdAndUpdate(user.id, { unusedTickets: unusedTickets });
    }
  }

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount:
        parseFloat((el.article.priceDDV - el.article.price).toFixed(2)) *
        el.quantity,
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
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: "BLAGO",
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
      amountWithTax: el.article.priceDDV,
      quantity: el.quantity,
      item: el.article.name.sl,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: req.user.id,
    company: req.body.company,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
      invoiceNo: lastInvoice
        ? Number(lastInvoice.invoiceData.invoiceNo) + 1
        : 1,
    },
    soldItems,
    paymentMethod: req.body.paymentMethod,
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(invoiceDataToSave);

  await invoice.populate({
    path: "buyer issuer",
    select:
      "email firstName lastName phoneNumber invoiceNickname postalCode city address",
  });

  const buyer = invoice.buyer as any;

  const mailOptions = {
    email: invoice.buyer ? buyer.email : invoice.recepient.email,
    invoiceNumber: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    name: invoice.company.name
      ? invoice.company.name
      : invoice.buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    companyName: invoice.company.name,
    taxNumber: invoice.company.taxNumber,
    address: invoice.company.address
      ? invoice.company.address
      : invoice.buyer
      ? buyer.address
      : invoice.recepient.address,
    postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : invoice.buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    city: invoice.company.city
      ? invoice.company.city
      : invoice.buyer
      ? buyer.city
      : invoice.recepient.city,
    invoiceDate: invoice.invoiceDate,
    invoiceCompletionDate: invoice.serviceCompletionDate,
    reference: invoice.reference,
    cashier: invoice.issuerNickname ? invoice.issuerNickname : "Default",
    dueDate: invoice.paymentDueDate,
    paymentMethod: invoice.paymentMethod,
    items: invoice.soldItems,
    totalAmount: invoice.totalAmount,
    totalTaxAmount: invoice.totalAmount - invoice.totalTaxableAmount,
    EOR: invoice.EOR,
    ZOI: invoice.ZOI,
  };

  await sendInvoice(mailOptions);

  res.status(200).json({
    status: "success",
  });
});

export const buyGiftOnline = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id);

  if (!user) return next(new AppError("User not found", 404));

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAGO",
  }).sort({
    "invoiceData.invoiceNo": -1,
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: { articleId: string; quantity: number }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const articleToBuy = {
          article,
          quantity: el.quantity,
        };

        return articleToBuy;
      }
    )
  );

  for (const el of cart) {
    const data = {
      article: el.article.id,
      giftCode: generateRandomString(8),
      label: el.article.label,
    };
    const gift = await Gift.create(data);

    if (!gift) return next(new AppError("Something went wrong!", 500));

    await sendCode({
      firstName: user.firstName,
      code: gift.giftCode,
      email: req.user.email,
      article: el.article.name.sl,
    });
  }

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount:
        parseFloat((el.article.priceDDV - el.article.price).toFixed(2)) *
        el.quantity,
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
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: "BLAGO",
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
      amountWithTax: el.article.priceDDV,
      quantity: el.quantity,
      item: `${el.article.name.sl} - darilni bon`,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: user.id,
    company: req.body.company,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
      invoiceNo: lastInvoice
        ? Number(lastInvoice.invoiceData.invoiceNo) + 1
        : 1,
    },
    soldItems,
    paymentMethod: req.body.paymentMethod,
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(invoiceDataToSave);

  await invoice.populate({
    path: "buyer issuer",
    select:
      "email firstName lastName phoneNumber invoiceNickname postalCode city address",
  });

  const buyer = invoice.buyer as any;

  const mailOptions = {
    email: invoice.buyer ? buyer.email : invoice.recepient.email,
    invoiceNumber: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    name: invoice.company.name
      ? invoice.company.name
      : invoice.buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    companyName: invoice.company.name,
    taxNumber: invoice.company.taxNumber,
    address: invoice.company.address
      ? invoice.company.address
      : invoice.buyer
      ? buyer.address
      : invoice.recepient.address,
    postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : invoice.buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    city: invoice.company.city
      ? invoice.company.city
      : invoice.buyer
      ? buyer.city
      : invoice.recepient.city,
    invoiceDate: invoice.invoiceDate,
    invoiceCompletionDate: invoice.serviceCompletionDate,
    reference: invoice.reference,
    cashier: invoice.issuerNickname ? invoice.issuerNickname : "Default",
    dueDate: invoice.paymentDueDate,
    paymentMethod: invoice.paymentMethod,
    items: invoice.soldItems,
    totalAmount: invoice.totalAmount,
    totalTaxAmount: invoice.totalAmount - invoice.totalTaxableAmount,
    EOR: invoice.EOR,
    ZOI: invoice.ZOI,
  };

  await sendInvoice(mailOptions);

  res.status(200).json({
    status: "success",
  });
});

export const buyArticlesInPerson = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //preveri vpis v blagajno in ip

  const user = await User.findById(req.params.id).populate({
    path: "parent",
    select: "email",
  });

  if (!user) return next(new AppError("User not found", 404));

  if (!req.body.paymentMethod)
    return next(new AppError("Please provide payment method!", 400));

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAG1",
  }).sort({
    "invoiceData.invoiceNo": -1,
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: {
        articleId: string;
        quantity: number;
        classId: string[];
        gift: boolean;
        useNow: boolean;
        otherId: string;
        childId: string;
      }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const articleToBuy = {
          article,
          quantity: el.quantity,
          gift: el.gift,
          useNow: el.useNow,
          otherId: el.otherId,
          classId: el.classId,
          childId: el.childId,
        };

        return articleToBuy;
      }
    )
  );

  for (const el of cart) {
    if (el.article.label === "V") {
      if (!el.gift && !el.useNow && !el.otherId) {
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
          article: el.article.id,
          giftCode: generateRandomString(8),
          label: el.article.label,
        };

        await Promise.all(
          Array.from({ length: el.quantity }).map(async () => {
            const gift = await Gift.create(data);

            if (!gift) return next(new AppError("Something went wrong!", 500));

            await sendCode({
              firstName: user.firstName,
              code: gift.giftCode,
              email: user.email,
              article: el.article.name.sl,
            });
          })
        );
      }

      if (el.useNow && !el.otherId) {
        const data: any = {
          name: el.article.name,
          type: el.article.type,
          duration: el.article.duration,
          visits: el.article.visits,
          user: user.id,
          used: true,
        };

        if (el.article.type === "paket") {
          data.visitsLeft = el.article.visits - 1;
        }

        const ticket = await Ticket.create(data);

        if (!ticket) return next(new AppError("Something went wrong!", 500));

        if (el.article.type !== "dnevna") {
          const unusedTickets = [...user.unusedTickets, ticket.id];
          await User.findByIdAndUpdate(user.id, {
            unusedTickets: unusedTickets,
          });
        }

        await Visit.create({
          date: new Date(),
          user: user.id,
          ticket: ticket.id,
        });
      }

      if (el.otherId) {
        const otherUser = await User.findById(el.otherId);
        if (!otherUser) return next(new AppError("User not found", 404));
        let tickets: ObjectId[] = [];

        await Promise.all(
          Array.from({ length: el.quantity }).map(async () => {
            const data: any = {
              name: el.article.name,
              type: el.article.type,
              duration: el.article.duration,
              visits: el.article.visits,
              user: el.otherId,
              used: el.useNow,
            };

            if (el.useNow && el.article.visits) {
              data.visitsLeft = el.article.visits - 1;
            }

            const ticket = await Ticket.create(data);

            if (!ticket)
              return next(new AppError("Something went wrong!", 500));

            if (
              el.article.type === "paket" ||
              el.article.type === "terminska" ||
              !el.useNow
            ) {
              tickets = [...tickets, ticket.id];
            }

            if (el.useNow) {
              await Visit.create({
                date: new Date(),
                user: el.otherId,
                ticket: ticket.id,
              });
            }
          })
        );
        const unusedTickets = [...otherUser.unusedTickets, ...tickets];
        await User.findByIdAndUpdate(otherUser.id, {
          unusedTickets: unusedTickets,
        });
      }
    }

    if (el.article.label === "A" || el.article.label === "VV") {
      if (!el.gift) {
        for (const id of el.classId) {
          const currentClass = await Class.findById(id);

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
      }
    }
  }

  const taxes = cart.map((el) => {
    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: el.article.price * el.quantity,
      taxAmount:
        parseFloat((el.article.priceDDV - el.article.price).toFixed(2)) *
        el.quantity,
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
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: "BLAG1",
    invoiceNumber: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    invoiceAmount: totalPrice,
    paymentAmount: totalPrice,
    taxes,
    operatorTaxNumber: req.user.taxNo || process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const soldItems = cart.map((el) => {
    const item = {
      taxRate: el.article.taxRate,
      taxableAmount: el.article.price.toFixed(2),
      amountWithTax: el.article.priceDDV,
      quantity: el.quantity,
      item: `${el.article.name.sl} ${el.gift ? "- darilni bon" : ""}`,
    };
    return item;
  });

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    buyer: user.id,
    company: req.body.company,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
      invoiceNo: lastInvoice
        ? Number(lastInvoice.invoiceData.invoiceNo) + 1
        : 1,
    },
    soldItems,
    paymentMethod: req.body.paymentMethod,
    issuer: req.user.id,
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(invoiceDataToSave);

  await invoice.populate({
    path: "buyer issuer",
    select:
      "email firstName lastName phoneNumber invoiceNickname postalCode city address",
  });

  const buyer = invoice.buyer as any;
  const parent = user.parent as any;

  const mailOptions = {
    email: invoice.buyer
      ? buyer.email
      : parent.email
      ? parent.email
      : invoice.recepient.email,
    invoiceNumber: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    name: invoice.buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    companyName: invoice.company.name,
    taxNumber: invoice.company.taxNumber,
    address: invoice.company.address
      ? invoice.company.address
      : invoice.buyer
      ? buyer.address
      : invoice.recepient.address,
    postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : invoice.buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    city: invoice.company.city
      ? invoice.company.city
      : invoice.buyer
      ? buyer.city
      : invoice.recepient.city,
    invoiceDate: invoice.invoiceDate,
    invoiceCompletionDate: invoice.serviceCompletionDate,
    reference: invoice.reference,
    cashier: invoice.issuerNickname ? invoice.issuerNickname : "Default",
    dueDate: invoice.paymentDueDate,
    paymentMethod: invoice.paymentMethod,
    items: invoice.soldItems,
    totalAmount: invoice.totalAmount,
    totalTaxAmount: invoice.totalAmount - invoice.totalTaxableAmount,
    EOR: invoice.EOR,
    ZOI: invoice.ZOI,
  };

  await sendInvoice(mailOptions);

  res.status(200).json({
    status: "success",
    cart,
  });
});
