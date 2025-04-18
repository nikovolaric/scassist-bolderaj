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

export const getMultipleDateClasses = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classes = await Class.find({
    $expr: {
      $gt: [{ $size: "$dates" }, 1],
    },
    ...req.query,
  }).sort({ dates: 1 });

  res.status(200).json({
    status: "success",
    classes,
  });
});

export const getSingleDateClasses = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const allClasses = await Class.find({
    dates: { $size: 1 },
    ...req.query,
  }).sort({
    dates: 1,
  });

  const classes = allClasses.filter((el) => el.dates[0] > new Date());

  res.status(200).json({
    status: "success",
    classes,
  });
});

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

  const article = await Article.findById(req.body.articles.articleId);

  const classes = req.body.articles.classes;

  if (!article) return next(new AppError("Article not found", 404));

  for (const classId of classes) {
    const currentClass = await Class.findById(classId);

    if (!currentClass) return next(new AppError("Class not found", 404));

    if (
      currentClass.full ||
      currentClass.students.length >= currentClass.maxStudents
    )
      return next(new AppError("Class is full", 400));

    if (
      currentClass.students.map(
        (student) => student.student === currentUser._id
      ).length > 0
    )
      return next(
        new AppError("You are already signed up for this class", 400)
      );

    currentClass.students.push({ student: currentUser._id, attendance: [] });
    if (currentClass.students.length >= currentClass.maxStudents) {
      currentClass.full = true;
    }

    await currentClass.save({ validateBeforeSave: false });
  }

  if (req.body.articles.paymentMethod === "") {
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
      invoiceAmount: article.endDate
        ? article.classPriceData.price
        : article.price,
      paymentAmount: article.endDate
        ? article.classPriceData.price
        : article.price,
      taxes: [
        {
          taxRate: article.taxRate * 100,
          taxableAmount: article.endDate
            ? article.classPriceData.price
            : article.price,
          taxAmount: article.endDate
            ? article.classPriceData.price * article.taxRate
            : article.price * article.taxRate,
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
        taxableAmount: article.endDate
          ? article.classPriceData.price
          : article.price,
        taxAmount: article.endDate
          ? article.classPriceData.price * article.taxRate
          : article.price * article.taxRate,
        quantity: 1,
        item: `${article.name}`,
      },
      paymentMethod: "online",
      ZOI,
      EOR,
    };

    const newInvoice = await Invoice.create(invoiceDataToSave);

    res.status(200).json({
      status: "success",
      invoice: newInvoice,
    });
  }

  if (req.body.articles.paymentMethod === "preInvoice") {
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
          taxableAmount: article.endDate
            ? article.classPriceData.price
            : article.price,
          taxAmount:
            (article.endDate ? article.classPriceData.price : article.price) *
            article.taxRate,
          quantity: 1,
          item: `${article.name}`,
        },
      ],
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      user: req.user._id,
      classes,
    };

    const preInvoice = await PreInvoice.create(preInvoiceData);

    res.status(200).json({
      status: "success",
      preInvoice,
    });
  }
});

export const signUpChildForClassOnline = catchAsync(async function (
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

  const child = await User.findById(childId);

  if (!child) return next(new AppError("User not found", 404));

  const article = await Article.findById(req.body.articles.articleId);

  if (!article) return next(new AppError("Article not found", 404));

  const classes = req.body.articles.classes;

  for (const classId of classes) {
    const currentClass = await Class.findById(classId);

    if (!currentClass) return next(new AppError("Class not found", 404));

    if (
      currentClass.full ||
      currentClass.students.length >= currentClass.maxStudents
    )
      return next(new AppError("Class is full", 400));

    if (
      currentClass.students.filter((student) => student.student === child._id)
        .length > 0
    )
      return next(
        new AppError("You are already signed up for this class", 400)
      );

    currentClass.students.push({ student: child._id, attendance: [] });
    if (currentClass.students.length >= currentClass.maxStudents) {
      currentClass.full = true;
    }

    await currentClass.save({ validateBeforeSave: false });
  }

  if (req.body.articles.paymentMethod === "") {
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
      invoiceAmount: article.endDate
        ? article.classPriceData.price
        : article.price,
      paymentAmount: article.endDate
        ? article.classPriceData.price
        : article.price,
      taxes: [
        {
          taxRate: article.taxRate * 100,
          taxableAmount: article.endDate
            ? article.classPriceData.price
            : article.price,
          taxAmount: article.endDate
            ? article.classPriceData.price * article.taxRate
            : article.price * article.taxRate,
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
        taxableAmount: article.endDate
          ? article.classPriceData.price
          : article.price,
        taxAmount: article.endDate
          ? article.classPriceData.price * article.taxRate
          : article.price * article.taxRate,
        quantity: 1,
        item: `${article.name}`,
      },
      paymentMethod: "online",
      ZOI,
      EOR,
    };

    const newInvoice = await Invoice.create(invoiceDataToSave);

    res.status(200).json({
      status: "success",
      invoice: newInvoice,
    });
  }

  if (req.body.articles.paymentMethod === "preInvoice") {
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
          taxableAmount: article.endDate
            ? article.classPriceData.price
            : article.price,
          taxAmount:
            (article.endDate ? article.classPriceData.price : article.price) *
            article.taxRate,
          quantity: 1,
          item: `${article.name}`,
        },
      ],
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      user: req.user._id,
      classes,
    };

    const preInvoice = await PreInvoice.create(preInvoiceData);

    res.status(200).json({
      status: "success",
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
  }).select("name teacher dates time className");

  res.status(200).json({
    status: "success",
    classes,
  });
});

export const getChildClasses = catchAsync(async function (
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

  const classes = await Class.find({
    students: { $elemMatch: { student: childId } },
  }).select("name teacher dates time className");

  res.status(200).json({
    status: "success",
    classes,
  });
});
