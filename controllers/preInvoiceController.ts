import { NextFunction, Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import { createOne } from "./handlerFactory";
import PreInvoice from "../models/preInvoiceModel";
import Invoice from "../models/invoiceModel";
import User from "../models/userModel";
import Article from "../models/articleModel";
import AppError from "../utils/appError";
import {
  connectWithFURS,
  generateJSONInvoice,
} from "../utils/createJSONInvoice";
import { parse } from "csv-parse/sync";

export const createPreInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.body.user);

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

  const soldItems = cart.map((el) => {
    const item = {
      taxRate: el.article.taxRate,
      taxableAmount: el.article.price.toFixed(2),
      quantity: el.quantity,
      item: el.article.name,
    };
    return item;
  });

  const preInvoiceDataToSave = {
    recepient: user
      ? {
          name: `${user.firstName}${user.lastName}`,
          address: user.address,
          city: user.city,
          postalCode: user.postalCode,
          company: user.company,
          taxNumber: user.taxNo,
          email: user.email,
          phoneNumber: user.phoneNumber,
        }
      : req.body.recepient,
    date: req.body.date,
    dueDate: req.body.dueDate,
    items: soldItems,
  };

  const preInvoice = await PreInvoice.create(preInvoiceDataToSave);

  res.status(200).json({
    status: "success",
    preInvoice,
  });
});

export const createInvoiceFromPreInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const preInvoice = await PreInvoice.findById(req.params.id);

  if (!preInvoice) {
    return next(new Error("PreInvoice not found"));
  }

  const lastInvoice = await Invoice.findOne().sort({
    "invoiceData.invoiceNo": -1,
  });

  const { recepient, dueDate, reference, items, totalAmount } = preInvoice;

  const taxes = items.map((el) => {
    const tax = {
      taxRate: el.taxRate * 100,
      taxableAmount: el.taxableAmount * el.quantity,
      taxAmount: el.taxableAmount * el.taxRate * el.quantity,
    };
    return tax;
  });

  const invoiceData = {
    dateTime: new Date(),
    issueDateTime: new Date(),
    numberingStructure: "C",
    businessPremiseID: "PC1",
    electronicDeviceID: "BO",
    invoiceNumber: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    invoiceAmount: totalAmount,
    paymentAmount: totalAmount,
    taxes,
    operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const newInvoiceData = {
    paymentDueDate: req.body.dueDate || dueDate,
    recepient,
    reference,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
    },
    soldItems: items,
    paymentMethod: "nakazilo",
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(newInvoiceData);

  res.status(201).json({
    status: "success",
    invoice,
  });
});

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export const checkPayedPreInvoices = catchAsync(async function (
  req: MulterRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded!" });
  }

  const csvBuffer = req.file.buffer;
  const records = parse(csvBuffer);

  // Pridobi sklice iz CSV
  const references = records
    .map((el: any) => el[0].split(";").slice(-1)[0])
    .slice(1);

  // ✅ Pridobi vse preInvoice naenkrat
  const preInvoices = await PreInvoice.find({ reference: { $in: references } });

  // ✅ Pridobi zadnji invoice samo enkrat
  let lastInvoice = await Invoice.findOne().sort({
    "invoiceData.invoiceNo": -1,
  });
  let currentInvoiceNo = lastInvoice
    ? Number(lastInvoice.invoiceData.invoiceNo) + 1
    : 1;

  for (const sklic of references) {
    const preInvoice = preInvoices.find((p) => p.reference === sklic);

    if (!preInvoice || preInvoice.payed) {
      console.error(`PreInvoice not found or already payed: ${sklic}`);
      continue; // ⬅️ Namesto return uporabi continue, da nadaljuje z ostalimi!
    }

    const { recepient, dueDate, reference, items, totalAmount } = preInvoice;

    const taxes = items.map((el) => ({
      taxRate: el.taxRate * 100,
      taxableAmount: el.taxableAmount * el.quantity,
      taxAmount: el.taxableAmount * el.taxRate * el.quantity,
    }));

    const invoiceData = {
      dateTime: new Date(),
      issueDateTime: new Date(),
      numberingStructure: "C",
      businessPremiseID: "PC1",
      electronicDeviceID: "BO",
      invoiceNumber: currentInvoiceNo, // ✅ Vedno povečaj številko računa
      invoiceAmount: totalAmount,
      paymentAmount: totalAmount,
      taxes,
      operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    };

    const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);
    const EOR = await connectWithFURS(JSONInvoice);

    const newInvoiceData = {
      paymentDueDate: req.body.dueDate || dueDate,
      recepient,
      reference,
      invoiceData: {
        businessPremises: invoiceData.businessPremiseID,
        deviceNo: invoiceData.electronicDeviceID,
        invoiceNo: invoiceData.invoiceNumber,
      },
      soldItems: items,
      paymentMethod: "nakazilo",
      ZOI,
      EOR,
    };

    const invoice = await Invoice.create(newInvoiceData);

    if (invoice) {
      await PreInvoice.findByIdAndUpdate(preInvoice.id, { payed: true });
    }

    currentInvoiceNo++; // ✅ Povečaj številko računa za naslednji račun
  }

  res.status(201).json({
    status: "success",
  });
});
