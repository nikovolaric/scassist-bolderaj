import { NextFunction, Request, Response } from "express";
import archiver from "archiver";
import Invoice from "../models/invoiceModel";
import catchAsync from "../utils/catchAsync";
import {
  bussinesPremises,
  connectWithFURS,
  echoFurs,
  generateJSONInvoice,
  generateJSONInvoiceStorno,
} from "../utils/createJSONInvoice";
import AppError from "../utils/appError";
import Article from "../models/articleModel";
import User from "../models/userModel";
import { generateInvoicePDFBuffer } from "../templates/sendInvoiceTemplate";
import { Types } from "mongoose";
import APIFeatures from "../utils/apiFeatures";
import { updateOne } from "./handlerFactory";

export const updateInvoice = updateOne(Invoice);

export const getAllInvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {
    q,
    dateFrom,
    dateTo,
    dateFromDone,
    dateToDone,
    article,
    label,
    buyerFullName,
    issuer,
    taxNo,
    ...query
  } = req.query;

  let filter = {};

  if (q && typeof q === "string") {
    const parts = q.split(/[-\s]+/); // razdeli po "-" ali presledku
    const [devicePart, invoicePart] = parts;

    filter = {
      ...filter,
      $and: [
        devicePart
          ? { "invoiceData.deviceNo": { $regex: devicePart, $options: "i" } }
          : {},
        invoicePart
          ? {
              $expr: {
                $regexMatch: {
                  input: { $toString: "$invoiceData.invoiceNo" },
                  regex: invoicePart,
                  options: "i",
                },
              },
            }
          : {},
      ],
    };
  }

  if (dateFrom && dateTo) {
    filter = {
      ...filter,
      invoiceDate: {
        $gte: new Date(dateFrom as string),
        $lte: new Date(dateTo as string),
      },
    };
  }

  if (dateFromDone && dateToDone) {
    filter = {
      ...filter,
      serviceCompletionDate: {
        $gte: new Date(dateFrom as string),
        $lte: new Date(dateTo as string),
      },
    };
  }

  if (article) {
    filter = {
      ...filter,
      "soldItems.item": { $regex: article, $options: "i" },
    };
  }

  if (label) {
    const matchingArticles = await Article.find({
      label,
    }).select("name");

    const articleNames = matchingArticles.map((a) => a.name.sl);

    filter = { ...filter, "soldItems.item": { $in: articleNames } };
  }

  if (buyerFullName) {
    const [firstName, ...lastNameParts] = (buyerFullName as string).split(" ");
    const lastName = lastNameParts.join(" ");

    const buyersObject = await User.find({
      firstName: { $regex: `^${firstName}`, $options: "i" },
      lastName: { $regex: `^${lastName}`, $options: "i" },
    });

    const buyerArray = buyersObject.map((a) => a._id);

    filter = { ...filter, buyer: { $in: buyerArray } };
  }

  if (issuer) {
    const [firstName, ...lastNameParts] = (issuer as string).split(" ");
    const lastName = lastNameParts.join(" ");

    const issuersObject = await User.find({
      firstName: { $regex: `^${firstName}`, $options: "i" },
      lastName: { $regex: `^${lastName}`, $options: "i" },
    });

    const issuerArray = issuersObject.map((a) => a._id);

    filter = { ...filter, issuer: { $in: issuerArray } };
  }

  if (taxNo) {
    filter = {
      ...filter,
      "company.taxNumber": { $regex: taxNo, $options: "i" },
    };
  }

  const features = new APIFeatures(
    Invoice.find(filter).populate({
      path: "buyer",
      select: "firstName lastName",
    }),
    query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const invoices = await features.query;

  res.status(200).json({
    status: "success",
    results: invoices.length,
    invoices,
  });
});

export const getInvoicesTotalSum = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {
    dateFrom,
    dateTo,
    dateFromDone,
    dateToDone,
    article,
    label,
    buyerFullName,
    issuer,
    taxNo,
    ...query
  } = req.query;

  let filter: any = query;

  if (dateFrom && dateTo) {
    filter = {
      ...filter,
      invoiceDate: {
        $gte: new Date(dateFrom as string),
        $lte: new Date(dateTo as string),
      },
    };
  }

  if (dateFromDone && dateToDone) {
    filter = {
      ...filter,
      serviceCompletionDate: {
        $gte: new Date(dateFrom as string),
        $lte: new Date(dateTo as string),
      },
    };
  }

  if (article) {
    filter = {
      ...filter,
      "soldItems.item": { $regex: article, $options: "i" },
    };
  }

  if (label) {
    const matchingArticles = await Article.find({
      label,
    }).select("name");

    const articleNames = matchingArticles.map((a) => a.name.sl);

    filter = { ...filter, "soldItems.item": { $in: articleNames } };
  }

  if (buyerFullName) {
    const [firstName, ...lastNameParts] = (buyerFullName as string).split(" ");
    const lastName = lastNameParts.join(" ");

    const buyersObject = await User.find({
      firstName: { $regex: `^${firstName}`, $options: "i" },
      lastName: { $regex: `^${lastName}`, $options: "i" },
    });

    const buyerArray = buyersObject.map((a) => a._id);

    filter = { ...filter, buyer: { $in: buyerArray } };
  }

  if (issuer) {
    const [firstName, ...lastNameParts] = (issuer as string).split(" ");
    const lastName = lastNameParts.join(" ");

    const issuersObject = await User.find({
      firstName: { $regex: `^${firstName}`, $options: "i" },
      lastName: { $regex: `^${lastName}`, $options: "i" },
    });

    const issuerArray = issuersObject.map((a) => a._id);

    filter = { ...filter, issuer: { $in: issuerArray } };
  }

  if (taxNo) {
    filter = {
      ...filter,
      "company.taxNumber": { $regex: taxNo, $options: "i" },
    };
  }

  const result = await Invoice.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalAmountSum: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalAmount = result[0]?.totalAmountSum || 0;
  const invoiceCount = result[0]?.count || 0;

  res.status(200).json({
    status: "success",
    results: invoiceCount,
    totalAmount,
  });
});

export const createInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let buyer;
  if (req.body.buyer) {
    buyer = await User.findById(req.body.buyer);
  }

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": "BLAGO",
  }).sort({
    "invoiceData.invoiceNo": -1,
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

  const taxes = cart.map((el) => {
    const discount = el.discount;

    const netUnit = el.article.price * (1 - discount);
    const grossUnit = el.article.priceDDV * (1 - discount);

    const tax = {
      taxRate: el.article.taxRate * 100,
      taxableAmount: netUnit,
      taxAmount: grossUnit - netUnit,
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

  const invoiceDataToSave = {
    invoiceDate: req.body.invoiceDate || new Date(),
    paymentDueDate: req.body.paymentDueDate || new Date(),
    serviceCompletionDate: req.body.serviceCompletionDate || new Date(),
    company: req.body.company,
    buyer: buyer?.id,
    recepient: req.body.recepient,
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceID,
      invoiceNo: invoiceData.invoiceNumber,
    },
    soldItems,
    paymentMethod: req.body.paymentMethod,
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
  const year = req.params.year;

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const invoices = await Invoice.find({
    buyer: req.user.id,
    invoiceDate: { $gte: startDate, $lte: endDate },
  })
    .populate({
      path: "buyer",
      select: "firstName lastName email address city country",
    })
    .sort({ invoiceDate: -1 });

  res.status(200).json({
    status: "success",
    results: invoices.length,
    invoices,
  });
});

export const myIssuedInvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const invoices = await Invoice.aggregate([
    {
      $match: {
        issuer: new Types.ObjectId(req.user.id),
        invoiceDate: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    {
      $lookup: {
        from: "users", // ime kolekcije (navadno množina modela)
        localField: "buyer",
        foreignField: "_id",
        as: "buyer",
      },
    },
    { $unwind: "$buyer" },
    {
      $match: {
        "buyer.lastName": {
          $regex: req.query.name || "",
          $options: "i",
        },
      },
    },
    {
      $project: {
        invoiceData: 1,
        invoiceDate: 1,
        paymentMethod: 1,
        buyer: {
          firstName: 1,
          lastName: 1,
          email: 1,
          address: 1,
          city: 1,
          country: 1,
        },
      },
    },
    {
      $sort: { invoiceDate: -1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    results: invoices.length,
    invoices,
  });
});

export const downloadMyInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id = req.params.id;

  const invoice = await Invoice.findOne({
    _id: id,
    buyer: req.user._id,
  }).populate({
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
    completed_date: invoice.serviceCompletionDate,
    company_name: buyer ? buyer.companyName : "",
    issuer: issuer ? issuer.invoiceNickname : "Default",
    reference_number: invoice.reference,
    customer_name: invoice.company.name
      ? invoice.company.name
      : buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    customer_address: invoice.company.address
      ? invoice.company.address
      : buyer
      ? buyer.address
      : invoice.recepient.address,
    customer_postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    customer_city: invoice.company.city
      ? invoice.company.city
      : buyer
      ? buyer.city
      : invoice.recepient.city,
    tax_number: invoice.company.taxNumber,
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
    completed_date: invoice.serviceCompletionDate,
    company_name: buyer ? buyer.companyName : "",
    issuer: issuer ? issuer.invoiceNickname : "Default",
    reference_number: invoice.reference,
    customer_name: invoice.company.name
      ? invoice.company.name
      : buyer
      ? `${buyer.firstName} ${buyer.lastName}`
      : invoice.recepient.name,
    customer_address: invoice.company.address
      ? invoice.company.address
      : buyer
      ? buyer.address
      : invoice.recepient.address,
    customer_postalCode: invoice.company.postalCode
      ? invoice.company.postalCode
      : buyer
      ? buyer.postalCode
      : invoice.recepient.postalCode,
    customer_city: invoice.company.city
      ? invoice.company.city
      : buyer
      ? buyer.city
      : invoice.recepient.city,
    tax_number: invoice.company.taxNumber,
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
        completed_date: invoice.serviceCompletionDate,
        company_name: buyer ? buyer.companyName : "",
        issuer: issuer ? issuer.invoiceNickname : "Default",
        reference_number: invoice.reference,
        customer_name: invoice.company.name
          ? invoice.company.name
          : buyer
          ? `${buyer.firstName} ${buyer.lastName}`
          : invoice.recepient.name,
        customer_address: invoice.company.address
          ? invoice.company.address
          : buyer
          ? buyer.address
          : invoice.recepient.address,
        customer_postalCode: invoice.company.postalCode
          ? invoice.company.postalCode
          : buyer
          ? buyer.postalCode
          : invoice.recepient.postalCode,
        custumer_city: invoice.company.city
          ? invoice.company.city
          : buyer
          ? buyer.city
          : invoice.recepient.city,
        tax_number: invoice.company.taxNumber,
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

export const getUserInvoices = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {});

export const stornoInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError("Invoice does not exist!", 404));
  }

  const lastInvoice = await Invoice.findOne({
    "invoiceData.deviceNo": invoice.invoiceData.deviceNo,
  })
    .sort({
      "invoiceData.invoiceNo": -1,
    })
    .populate({
      path: "buyer",
      select: "firstName lastName address postalCode city",
    });

  const taxes = invoice.soldItems.map((el) => {
    const tax = {
      taxRate: el.taxRate * 100,
      taxableAmount: el.taxableAmount * el.quantity,
      taxAmount:
        parseFloat((el.amountWithTax - el.taxableAmount).toFixed(2)) *
        el.quantity,
    };
    return tax;
  });

  const invoiceData = {
    dateTime: new Date(),
    issueDateTime: new Date(),
    numberingStructure: "C",
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceIDNew: "BLAGO",
    invoiceNumberNew: lastInvoice
      ? Number(lastInvoice.invoiceData.invoiceNo) + 1
      : 1,
    electronicDeviceIDRef: invoice.invoiceData.deviceNo,
    businessPremiseIDRef: invoice.invoiceData.businessPremises,
    invoiceNumberRef: invoice.invoiceData.invoiceNo,
    issueDateTimeRef: new Date(invoice.invoiceDate),
    invoiceAmount: invoice.totalAmount,
    paymentAmount: invoice.totalAmount,
    taxes,
    operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
  };

  const { JSONInvoice, ZOI } = generateJSONInvoiceStorno(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  const soldItems = invoice.soldItems.map((el) => {
    const item = {
      taxRate: el.taxRate,
      taxableAmount: -el.taxableAmount,
      amountWithTax: -el.amountWithTax,
      quantity: el.quantity,
      item: el.item,
    };
    return item;
  });

  const buyer = invoice.buyer as any;

  const invoiceDataToSave = {
    paymentDueDate: new Date(),
    serviceCompletionDate: new Date(),
    recepient: {
      name: buyer.fullName,
      address: buyer.address,
      postalCode: buyer.postalCode,
      city: buyer.city,
    },
    invoiceData: {
      businessPremises: invoiceData.businessPremiseID,
      deviceNo: invoiceData.electronicDeviceIDNew,
      invoiceNo: invoiceData.invoiceNumberNew,
    },
    soldItems,
    paymentMethod: invoice.paymentMethod,
    ZOI,
    EOR,
  };

  const newInvoice = await Invoice.create(invoiceDataToSave);

  invoice.storno = true;
  await invoice.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    invoice: newInvoice,
  });
});

export const confirmFiscalInvoiceLater = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError("Invoice does not exist!", 404));
  }

  const taxes = invoice.soldItems.map((el) => {
    const tax = {
      taxRate: el.taxRate * 100,
      taxableAmount: el.taxableAmount * el.quantity,
      taxAmount: el.amountWithTax * el.quantity,
    };
    return tax;
  });

  const invoiceData = {
    dateTime: new Date(),
    issueDateTime: new Date(invoice.invoiceDate),
    numberingStructure: "C",
    businessPremiseID: process.env.BUSINESSID as string,
    electronicDeviceID: invoice.invoiceData.deviceNo,
    invoiceNumber: invoice.invoiceData.invoiceNo,
    invoiceAmount: invoice.totalAmount,
    paymentAmount: invoice.totalAmount,
    taxes,
    operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    protectedId: invoice.ZOI,
  };

  const { JSONInvoice } = generateJSONInvoice(invoiceData);

  const EOR = await connectWithFURS(JSONInvoice);

  invoice.EOR = EOR;

  await invoice.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    invoice,
  });
});

export const echoFiscal = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const data = await echoFurs();

  res.status(200).json({
    status: "success",
    data,
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

export const issueEmptyInvoice = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  // const taxes = [
  //   {
  //     taxRate: 0,
  //     taxableAmount: 0,
  //     taxAmount: 0,
  //   },
  // ];

  // const invoiceData = {
  //   dateTime: new Date(),
  //   issueDateTime: new Date(),
  //   numberingStructure: "C",
  //   businessPremiseID: process.env.BUSINESSID as string,
  //   electronicDeviceID: "BLAGO",
  //   invoiceNumber: 36,
  //   invoiceAmount: 0,
  //   paymentAmount: 0,
  //   taxes,
  //   operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
  // };

  // const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

  // const EOR = await connectWithFURS(JSONInvoice);

  // const invoiceDataToSave = {
  //   paymentDueDate: new Date(),
  //   buyer: "6842ac661417193595a3126f",
  //   invoiceData: {
  //     businessPremises: invoiceData.businessPremiseID,
  //     deviceNo: invoiceData.electronicDeviceID,
  //     invoiceNo: 36,
  //   },
  //   soldItems: [],
  //   paymentMethod: "online",
  //   ZOI,
  //   EOR,
  // };

  // await Invoice.create(invoiceDataToSave);

  const invoice = await Invoice.findOne({
    "invoiceData.deviceNo": process.env.BUSINESSID as string,
  }).sort({
    "invoiceData.invoiceNo": -1,
  });

  res.status(200).json({
    status: "success",
    invoice,
  });
});
