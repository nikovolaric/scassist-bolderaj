import { NextFunction, Request, Response } from "express";
import Class from "../models/classModel";
import catchAsync from "../utils/catchAsync";
import { deleteOne, getAll, updateOne } from "./handlerFactory";
import AppError from "../utils/appError";
import User from "../models/userModel";
import Invoice from "../models/invoiceModel";
import Article from "../models/articleModel";
import PreInvoice from "../models/preInvoiceModel";
import {
  connectWithFURS,
  generateJSONInvoice,
} from "../utils/createJSONInvoice";

export const getAllClasses = getAll(Class);
export const updateClass = updateOne(Class);
export const deleteClass = deleteOne(Class);

export const createClass = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.body.teacher);

  if (!user) return next(new AppError("User not found", 404));

  if (!user.role.includes("coach") && !req.user.role.includes("admin"))
    return next(new AppError("User is not a coach", 400));

  const newClass = await Class.create(req.body);

  res.status(201).json({
    status: "success",
    class: newClass,
  });
});

export const getOneClass = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const currentUser = req.user;

  const currentClass = await Class.findById(req.params.id).populate({
    path: "teacher students",
    select: "firstName lastName email dateOfBirth",
  });

  if (!currentClass) return next(new AppError("Class not found", 404));

  if (
    currentClass.teacher.toString() !== currentUser.id ||
    !req.user.role.includes("admin")
  )
    return next(new AppError("You are not the teacher of this class", 401));

  res.status(200).json({
    status: "success",
    class: currentClass,
  });
});

export const signUpForClassOnline = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const currentUser = await User.findById(req.user.id);

  if (!currentUser) return next(new AppError("User not found", 404));

  const article = await Article.findById(req.params.id);

  if (!article) return next(new AppError("Article not found", 404));

  const currentClass = await Class.findById(article.class);

  if (!currentClass) return next(new AppError("Class not found", 404));

  if (
    currentClass.full ||
    currentClass.students.length >= currentClass.maxStudents
  )
    return next(new AppError("Class is full", 400));

  if (
    currentClass.students.map((student) => student.student === currentUser._id)
      .length > 0
  )
    return next(new AppError("You are already signed up for this class", 400));

  currentClass.students.push({ student: currentUser._id, attendance: [] });
  if (currentClass.students.length >= currentClass.maxStudents) {
    currentClass.full = true;
  }

  if (!req.body.paymentMethod) {
    //preveri stripe plačilo

    const lastInvoice = await Invoice.findOne().sort({
      "invoiceData.invoiceNo": -1,
    });

    //ustvari invoice in podrdi na FURS
    const invoiceData = {
      dateTime: new Date(),
      taxNumber: process.env.BOLDERAJ_TAX_NUMBER,
      issueDateTime: new Date(),
      numberingStructure: "C",
      businessPremiseID: "PC1",
      electronicDeviceID: "BO",
      invoiceNumber: lastInvoice ? lastInvoice.invoiceData.invoiceNo + 1 : 1,
      invoiceAmount: article.price,
      paymentAmount: article.price,
      taxes: [
        {
          taxRate: article.taxRate * 100,
          taxableAmount: article.price,
          taxAmount: article.price * article.taxRate,
        },
      ],
      operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    };

    const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

    const EOR = await connectWithFURS(JSONInvoice);

    //shrani invoice v bazo
    const invoiceDataToSave = {
      paymentDueDate: new Date(),
      buyer: currentUser.id,
      invoiceData: {
        businessPremises: invoiceData.businessPremiseID,
        deviceNo: invoiceData.electronicDeviceID,
        invoiceNo: invoiceData.invoiceNumber.toString(),
      },
      soldItems: {
        taxRate: article.taxRate,
        taxableAmount: article.price,
        taxAmount: article.price * article.taxRate,
        quantity: 1,
        item: `${article.name}`,
      },
      paymentMethod: "online",
      ZOI,
      EOR,
    };

    const newInvoice = await Invoice.create(invoiceDataToSave);
    await currentClass.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      class: currentClass,
      invoice: newInvoice,
    });
  }

  if (req.body.paymentMethod === "preInvoice") {
    const preInvoiceData = {
      recepient: {
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        address: currentUser.address,
        city: currentUser.city,
        postalCode: currentUser.postalCode,
        email: currentUser.email,
        phoneNumber: currentUser.phoneNumber,
      },
      items: [
        {
          taxRate: article.taxRate,
          taxableAmount: article.price,
          taxAmount: article.price * article.taxRate,
          quantity: 1,
          item: `${article.name}`,
        },
      ],
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const preInvoice = await PreInvoice.create(preInvoiceData);

    await currentClass.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      class: currentClass,
      preInvoice,
    });
  }
});

export const signUpChildForClassOnline = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const childId = req.body.childId;

  if (
    req.user.parentOf.filter((el) => el.child.toString() === childId).length ===
    0
  )
    return next(new AppError("This is not your child", 403));

  const child = await User.findById(childId);

  if (!child) return next(new AppError("User not found", 404));

  const article = await Article.findById(req.params.id);

  if (!article) return next(new AppError("Article not found", 404));

  const currentClass = await Class.findById(article.class);

  if (!currentClass) return next(new AppError("Class not found", 404));

  if (
    currentClass.full ||
    currentClass.students.length >= currentClass.maxStudents
  )
    return next(new AppError("Class is full", 400));

  if (
    currentClass.students.map((student) => student.student === child._id)
      .length > 0
  )
    return next(new AppError("You are already signed up for this class", 400));

  currentClass.students.push({ student: child._id, attendance: [] });
  if (currentClass.students.length >= currentClass.maxStudents) {
    currentClass.full = true;
  }

  if (!req.body.paymentMethod) {
    //preveri stripe plačilo

    const lastInvoice = await Invoice.findOne().sort({
      "invoiceData.invoiceNo": -1,
    });

    //ustvari invoice in podrdi na FURS
    const invoiceData = {
      dateTime: new Date(),
      taxNumber: process.env.BOLDERAJ_TAX_NUMBER,
      issueDateTime: new Date(),
      numberingStructure: "C",
      businessPremiseID: "PC1",
      electronicDeviceID: "BO",
      invoiceNumber: lastInvoice ? lastInvoice.invoiceData.invoiceNo + 1 : 1,
      invoiceAmount: article.price,
      paymentAmount: article.price,
      taxes: [
        {
          taxRate: article.taxRate * 100,
          taxableAmount: article.price,
          taxAmount: article.price * article.taxRate,
        },
      ],
      operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    };

    const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

    const EOR = await connectWithFURS(JSONInvoice);

    //shrani invoice v bazo
    const invoiceDataToSave = {
      paymentDueDate: new Date(),
      buyer: req.user.id,
      invoiceData: {
        businessPremises: invoiceData.businessPremiseID,
        deviceNo: invoiceData.electronicDeviceID,
        invoiceNo: invoiceData.invoiceNumber.toString(),
      },
      soldItems: {
        taxRate: article.taxRate,
        taxableAmount: article.price,
        taxAmount: article.price * article.taxRate,
        quantity: 1,
        item: `${article.name}`,
      },
      paymentMethod: "online",
      ZOI,
      EOR,
    };

    const newInvoice = await Invoice.create(invoiceDataToSave);
    await currentClass.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      class: currentClass,
      invoice: newInvoice,
    });
  }

  if (req.body.paymentMethod === "preInvoice") {
    const preInvoiceData = {
      recepient: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        address: req.user.address,
        city: req.user.city,
        postalCode: req.user.postalCode,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
      },
      items: [
        {
          taxRate: article.taxRate,
          taxableAmount: article.price,
          taxAmount: article.price * article.taxRate,
          quantity: 1,
          item: `${article.name}`,
        },
      ],
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const preInvoice = await PreInvoice.create(preInvoiceData);

    await currentClass.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      class: currentClass,
      preInvoice,
    });
  }
});

export const checkAttendance = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const currentClass = await Class.findById(req.params.id);

  if (!currentClass) return next(new AppError("Class not found", 404));

  const currentUser = req.user;

  if (
    currentUser.id !== currentClass.teacher.toString() &&
    (!req.user.role.includes("admin") || !req.user.role.includes("employee"))
  )
    return next(new AppError("You are not the teacher of this class", 401));

  if (
    !currentClass.dates
      .map((date) => date.toString())
      .includes(new Date(req.body.date).toString())
  )
    return next(new AppError("Date not found", 404));

  currentClass.students.map((student) => {
    if (student.student.toString() === req.body.studentId) {
      student.attendance = [...student.attendance, req.body.date];
    }
  });

  await currentClass.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    class: currentClass,
  });
});

export const getMyClasses = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classes = await Class.find({
    students: { $elemMatch: { student: req.user._id } },
  }).select("name teacher dates time");

  res.status(200).json({
    status: "success",
    classes,
  });
});
