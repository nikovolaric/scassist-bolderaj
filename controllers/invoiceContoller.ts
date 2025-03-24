import { NextFunction, Request, Response } from "express";
import Invoice from "../models/invoiceModel";
import catchAsync from "../utils/catchAsync";
import { createOne, getAll } from "./handlerFactory";
import {
  connectWithFURS,
  generateJSONInvoice,
} from "../utils/createJSONInvoice";
import AppError from "../utils/appError";
import Article from "../models/articleModel";
import User from "../models/userModel";
import { generateInvoicePDFBuffer } from "../templates/sendInvoiceTemplate";
import archiver from "archiver";

export const getAllInvoices = getAll(Invoice);
export const createInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.body.user);

  const lastInvoice = await Invoice.findOne().sort({
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
    buyer: user?.id,
    recepient: req.body.recepient,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
    },
    soldItems,
    paymentMethod: "nakazilo",
    ZOI,
    EOR,
  };

  const invoice = await Invoice.create(invoiceDataToSave);

  res.status(200).json({
    status: "success",
    invoice,
  });
});

export const getMyInvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const invoices = await Invoice.find({ buyer: req.user.id }).populate({
    path: "buyer",
    select: "firstName lastName email address city country",
  });

  res.status(200).json({
    status: "success",
    results: invoices.length,
    invoices,
  });
});

export const downloadInvoicePDF = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const invoice = await Invoice.findById(req.params.id).populate({
    path: "buyer issuer",
    select: "-__v -birthdate",
  });

  if (!invoice) return next(new AppError("Invoice not found!", 404));

  res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
  res.setHeader("Content-Type", "application/pdf");

  const buyer = invoice.buyer as any;
  const issuer = invoice.issuer as any;

  const invoiceData = {
    invoice_number: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
    invoice_date: invoice.invoiceDate,
    completed_date: invoice.invoiceDate,
    company_name: buyer ? buyer.companyName : "",
    issuer: issuer ? issuer.invoiceNickname : "Default",
    reference_number: invoice.reference,
    customer_name: buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    customer_address: buyer ? buyer.address : invoice.recepient.address,
    customer_postalCode: buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    custumer_city: buyer ? buyer.city : invoice.recepient.city,
    tax_number: buyer ? buyer.taxNumber : invoice.recepient.taxNumber,
    total_with_tax: invoice.totalAmount,
    vat_amount: invoice.totalAmount - invoice.totalTaxableAmount,
    payment_method: invoice.paymentMethod,
    due_date: invoice.paymentDueDate,
    items: invoice.soldItems,
    ZOI: invoice.ZOI,
    EOR: invoice.EOR,
  };

  const pdf = await generateInvoicePDFBuffer(invoiceData);

  res.status(200).send(pdf);
});

export const downloadInvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const invoiceIds = req.body.invoiceIds;

  const archive = archiver("zip", { zlib: { level: 9 } });

  res.setHeader("Content-Disposition", 'attachment; filename="invoices.zip"');
  res.setHeader("Content-Type", "application/zip");

  archive.pipe(res);

  await Promise.all(
    invoiceIds.map(async (id: string) => {
      const invoice = await Invoice.findById(id).populate({
        path: "buyer issuer",
        select: "-__v -birthdate",
      });

      if (!invoice) return next(new AppError("Invoice not found!", 404));

      const buyer = invoice.buyer as any;
      const issuer = invoice.issuer as any;

      const invoiceData = {
        invoice_number: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}`,
        invoice_date: invoice.invoiceDate,
        completed_date: invoice.invoiceDate,
        company_name: buyer ? buyer.companyName : "",
        issuer: issuer ? issuer.invoiceNickname : "Default",
        reference_number: invoice.reference,
        customer_name: buyer
          ? `${buyer.firstName} ${buyer.lastName}`
          : invoice.recepient.name,
        customer_address: buyer ? buyer.address : invoice.recepient.address,
        customer_postalCode: buyer
          ? buyer.postalCode
          : invoice.recepient.postalCode,
        custumer_city: buyer ? buyer.city : invoice.recepient.city,
        tax_number: buyer ? buyer.taxNumber : invoice.recepient.taxNumber,
        total_with_tax: invoice.totalAmount,
        vat_amount: invoice.totalAmount - invoice.totalTaxableAmount,
        payment_method: invoice.paymentMethod,
        due_date: invoice.paymentDueDate,
        items: invoice.soldItems,
        ZOI: invoice.ZOI,
        EOR: invoice.EOR,
      };

      const pdf = await generateInvoicePDFBuffer(invoiceData);

      archive.append(pdf, {
        name: `${invoice.invoiceData.businessPremises}-${invoice.invoiceData.deviceNo}-${invoice.invoiceData.invoiceNo}-${invoice.invoiceData.year}.pdf`,
      });
    })
  );

  await archive.finalize();
});
