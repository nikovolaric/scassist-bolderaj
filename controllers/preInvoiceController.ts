import { NextFunction, Request, Response } from "express";
import { parse } from "csv-parse/sync";
import catchAsync from "../utils/catchAsync";
import PreInvoice from "../models/preInvoiceModel";
import Invoice from "../models/invoiceModel";
import User from "../models/userModel";
import Article from "../models/articleModel";
import AppError from "../utils/appError";
import {
  connectWithFURS,
  generateJSONInvoice,
} from "../utils/createJSONInvoice";
import { generatePreInvoicePDFBuffer } from "../templates/sendPreInvoiceTemplate";
import { deleteOne } from "./handlerFactory";
import APIFeatures from "../utils/apiFeatures";
import { sendInvoice, sendPreInvoice } from "../utils/email";

export const deletePreInvoice = deleteOne(PreInvoice);

export const getAllPreinvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { q, ...query } = req.query;

  let filter = {};

  if (q && typeof q === "string") {
    const regex = new RegExp(q, "i");

    filter = {
      $or: [
        { reference: { $regex: regex } },
        { "recepient.name": { $regex: regex } },
      ],
    };
  }

  const features = new APIFeatures(
    PreInvoice.find(filter).populate({
      path: "buyer",
      select: "firstName lastName",
    }),
    query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const preinvoices = await features.query;

  res.status(200).json({
    status: "success",
    results: preinvoices.length,
    preinvoices,
  });
});

export const createPreInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.body.buyer).populate({
    path: "parent",
    select: "email",
  });

  const cart = await Promise.all(
    req.body.articles.map(
      async (el: { articleId: string; quantity: number; discount: number }) => {
        const article = await Article.findById(el.articleId);
        if (!article) return next(new AppError("Article not found!", 404));

        const discount = el.discount ?? 0;

        const articleToBuy = {
          article,
          quantity: el.quantity,
          discount,
        };

        return articleToBuy;
      }
    )
  );

  const soldItems = cart.map((el) => {
    const discount = el.discount;

    const netUnit = el.article.price * (1 - discount);
    const grossUnit = el.article.priceDDV * (1 - discount);

    const item = {
      taxRate: el.article.taxRate,
      taxableAmount: netUnit,
      amountWithTax: grossUnit,
      quantity: el.quantity,
      item: el.article.name.sl,
    };
    return item;
  });

  const preInvoiceDataToSave = {
    recepient: user
      ? {
          name: `${user.fullName}`,
          address: user.address,
          city: user.city,
          postalCode: user.postalCode,
          company: user.company,
          taxNumber: user.taxNo,
          email: user.email,
          phoneNumber: user.phoneNumber,
        }
      : req.body.recepient,
    buyer: user?.id,
    company: req.body.company,
    date: req.body.date,
    dueDate: req.body.dueDate,
    items: soldItems,
  };

  const preInvoice = await PreInvoice.create(preInvoiceDataToSave);

  if (req.body.send) {
    const buyer = user as any;
    const parent = user?.parent as any;

    const mailOptions = {
      email: parent
        ? parent.email
        : preInvoice.buyer
        ? buyer.email
        : preInvoice.recepient.email,
      preInvoiceNumber: `${
        preInvoice.preInvoiceNumber
      }-${new Date().getFullYear()}`,
      invoiceDate: preInvoice.date,
      companyName: preInvoice.company.name,
      reference: preInvoice.reference,
      name: buyer
        ? `${buyer.firstName} ${buyer.lastName}`
        : preInvoice.recepient.name,
      address: preInvoice.company.address
        ? preInvoice.company.address
        : buyer
        ? buyer.address
        : preInvoice.recepient.address,
      postalCode: preInvoice.company.postalCode
        ? preInvoice.company.postalCode
        : buyer
        ? buyer.postalCode
        : preInvoice.recepient.postalCode,
      city: preInvoice.company.city
        ? preInvoice.company.city
        : buyer
        ? buyer.city
        : preInvoice.recepient.city,
      taxNumber: preInvoice.company.taxNumber,
      paymentMethod: "nakazilo",
      dueDate: preInvoice.dueDate,
      items: preInvoice.items,
      totalAmount: preInvoice.totalAmount,
      taxAmount: preInvoice.totalAmount - preInvoice.totalTaxableAmount,
    };

    await sendPreInvoice(mailOptions);
  }

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

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAGO",
  }).sort({
    "invoiceData.invoiceNo": -1,
  });

  const { recepient, reference, items, totalAmount, buyer, company } =
    preInvoice;

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
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: "BLAGO",
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
    invoiceDate: new Date(),
    paymentDueDate: new Date(),
    serviceCompletionDate: new Date(),
    recepient,
    company,
    buyer,
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

  preInvoice.payed = true;
  await preInvoice.save({ validateBeforeSave: false });

  await invoice.populate({
    path: "buyer issuer",
    select:
      "email firstName lastName phoneNumber invoiceNickname postalCode city address parent",
  });

  const invoiceBuyer = invoice.buyer as any;

  const parent = await User.findById(invoiceBuyer.parent);

  const mailOptions = {
    email: parent
      ? parent.email
      : invoice.buyer
      ? invoiceBuyer.email
      : invoice.recepient.email,
    invoiceNumber: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    name: invoice.company.name
      ? invoice.company.name
      : invoice.buyer
      ? `${invoiceBuyer.firstName} ${invoiceBuyer.lastName}`
      : invoice.recepient.name,
    companyName: invoice.company.name,
    taxNumber: invoice.company.taxNumber,
    address: invoice.company.address
      ? invoice.company.address
      : invoice.buyer
      ? invoiceBuyer.address
      : invoice.recepient.address,
    postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : invoice.buyer
      ? invoiceBuyer.postalCode
      : invoice.recepient.postalCode,
    city: invoice.company.city
      ? invoice.company.city
      : invoice.buyer
      ? invoiceBuyer.city
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

  const preInvoices = await PreInvoice.find({ reference: { $in: references } });

  let lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAGO",
  }).sort({
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

    const {
      recepient,
      dueDate,
      reference,
      items,
      totalAmount,
      buyer,
      company,
    } = preInvoice;

    const taxes = items.map((el) => ({
      taxRate: el.taxRate * 100,
      taxableAmount: el.taxableAmount * el.quantity,
      taxAmount: el.taxableAmount * el.taxRate * el.quantity,
    }));

    const invoiceData = {
      dateTime: new Date(),
      issueDateTime: new Date(),
      numberingStructure: "C",
      businessPremiseID: process.env.BUSINESSID as string,
      electronicDeviceID: "BLAGO",
      invoiceNumber: currentInvoiceNo,
      invoiceAmount: totalAmount,
      paymentAmount: totalAmount,
      taxes,
      operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    };

    const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);
    const EOR = await connectWithFURS(JSONInvoice);

    const newInvoiceData = {
      invoiceDate: new Date(),
      paymentDueDate: new Date(),
      serviceCompletionDate: new Date(),
      recepient,
      buyer,
      company,
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

export const getMyUnpaidPreInvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const preInvoices = await PreInvoice.find({
    buyer: req.user._id,
    payed: { $ne: true },
  });

  res.status(200).json({
    status: "success",
    results: preInvoices.length,
    preInvoices,
  });
});

export const downloadPreInvoiceFromClass = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classId = req.params.classId;

  const preInvoice = await PreInvoice.findOne({
    classes: { $in: [classId] },
    buyer: req.user._id,
  });

  if (!preInvoice) return next(new AppError("Preinvoice not found!", 404));

  res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
  res.setHeader("Content-Type", "application/pdf");

  const preInvoiceData = {
    invoice_number: preInvoice.preInvoiceNumber,
    invoice_date: preInvoice.date,
    company_name: preInvoice.company.name,
    reference_number: preInvoice.reference,
    customer_name: preInvoice.recepient.name,
    customer_address: preInvoice.company.address
      ? preInvoice.company.address
      : preInvoice.recepient.address,
    customer_postalCode: preInvoice.company.postalCode
      ? preInvoice.company.postalCode
      : preInvoice.recepient.postalCode,
    customer_city: preInvoice.company.city
      ? preInvoice.company.city
      : preInvoice.recepient.city,
    tax_number: preInvoice.company.taxNumber,
    total_with_tax: preInvoice.totalAmount,
    vat_amount: preInvoice.totalAmount - preInvoice.totalTaxableAmount,
    payment_method: "nakazilo",
    due_date: preInvoice.dueDate,
    items: preInvoice.items,
  };

  const pdf = await generatePreInvoicePDFBuffer(preInvoiceData);

  res.status(200).send(pdf);
});

export const downloadMyPreInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id = req.params.id;

  const preInvoice = await PreInvoice.findOne({
    _id: id,
    buyer: req.user.id,
  });

  if (!preInvoice) return next(new AppError("Preinvoice not found!", 404));

  res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
  res.setHeader("Content-Type", "application/pdf");

  const preInvoiceData = {
    invoice_number: preInvoice.preInvoiceNumber,
    invoice_date: preInvoice.date,
    company_name: preInvoice.company.name,
    reference_number: preInvoice.reference,
    customer_name: preInvoice.recepient.name,
    customer_address: preInvoice.company.address
      ? preInvoice.company.address
      : preInvoice.recepient.address,
    customer_postalCode: preInvoice.company.postalCode
      ? preInvoice.company.postalCode
      : preInvoice.recepient.postalCode,
    customer_city: preInvoice.company.city
      ? preInvoice.company.city
      : preInvoice.recepient.city,
    tax_number: preInvoice.company.taxNumber,
    total_with_tax: preInvoice.totalAmount,
    vat_amount: preInvoice.totalAmount - preInvoice.totalTaxableAmount,
    payment_method: "nakazilo",
    due_date: preInvoice.dueDate,
    items: preInvoice.items,
  };

  const pdf = await generatePreInvoicePDFBuffer(preInvoiceData);

  res.status(200).send(pdf);
});

export const getUserUnpaidPreinvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const preInvoices = await PreInvoice.find({
    buyer: req.params.id,
    payed: { $ne: true },
  });

  res.status(200).json({
    status: "success",
    results: preInvoices.length,
    preInvoices,
  });
});

export const downloadPreInvoiceReception = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const preInvoice = await PreInvoice.findById(req.params.id);

  if (!preInvoice) return next(new AppError("Preinvoice not found!", 404));

  res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
  res.setHeader("Content-Type", "application/pdf");

  const preInvoiceData = {
    invoice_number: preInvoice.preInvoiceNumber,
    invoice_date: preInvoice.date,
    company_name: preInvoice.company.name,
    reference_number: preInvoice.reference,
    customer_name: preInvoice.recepient.name,
    customer_address: preInvoice.company.address
      ? preInvoice.company.address
      : preInvoice.recepient.address,
    customer_postalCode: preInvoice.company.postalCode
      ? preInvoice.company.postalCode
      : preInvoice.recepient.postalCode,
    customer_city: preInvoice.company.city
      ? preInvoice.company.city
      : preInvoice.recepient.city,
    tax_number: preInvoice.company.taxNumber,
    total_with_tax: preInvoice.totalAmount,
    vat_amount: preInvoice.totalAmount - preInvoice.totalTaxableAmount,
    payment_method: "nakazilo",
    due_date: preInvoice.dueDate,
    items: preInvoice.items,
  };

  const pdf = await generatePreInvoicePDFBuffer(preInvoiceData);

  res.status(200).send(pdf);
});

export const createInvoiceFromPreInvoiceReception = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const preInvoice = await PreInvoice.findById(req.params.id);

  if (!preInvoice) {
    return next(new AppError("PreInvoice not found", 404));
  }

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAG1",
  }).sort({
    "invoiceData.invoiceNo": -1,
  });

  const { recepient, reference, items, totalAmount, buyer, company } =
    preInvoice;

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
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: "BLAG1",
    invoiceNumber: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    invoiceAmount: totalAmount,
    paymentAmount: totalAmount,
    taxes,
    operatorTaxNumber: req.user.taxNo || process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const newInvoiceData = {
    invoiceDate: new Date(),
    paymentDueDate: new Date(),
    serviceCompletionDate: new Date(),
    recepient,
    company,
    buyer,
    reference,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
      invoiceNo: invoiceData.invoiceNumber,
    },
    soldItems: items,
    paymentMethod: req.body.paymentMethod,
    issuer: req.user.id,
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(newInvoiceData);

  preInvoice.payed = true;
  await preInvoice.save({ validateBeforeSave: false });
  await invoice.populate({
    path: "buyer issuer",
    select:
      "email firstName lastName phoneNumber invoiceNickname postalCode city address parent",
  });

  const invoiceBuyer = invoice.buyer as any;
  const parent = await User.findById(invoiceBuyer.parent);

  const mailOptions = {
    email: parent
      ? parent.email
      : invoice.buyer
      ? invoiceBuyer.email
      : invoice.recepient.email,
    invoiceNumber: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    name: invoice.company.name
      ? invoice.company.name
      : invoice.buyer
      ? `${invoiceBuyer.firstName} ${invoiceBuyer.lastName}`
      : invoice.recepient.name,
    companyName: invoice.company.name,
    taxNumber: invoice.company.taxNumber,
    address: invoice.company.address
      ? invoice.company.address
      : invoice.buyer
      ? invoiceBuyer.address
      : invoice.recepient.address,
    postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : invoice.buyer
      ? invoiceBuyer.postalCode
      : invoice.recepient.postalCode,
    city: invoice.company.city
      ? invoice.company.city
      : invoice.buyer
      ? invoiceBuyer.city
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

  res.status(201).json({
    status: "success",
    invoice,
  });
});
