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
import { sendInvoice, sendPreInvoice } from "../utils/email";

export const getAllClasses = getAll(Class);
export const updateClass = updateOne(Class);
export const deleteClass = deleteOne(Class);

export const getMultipleDateClasses = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { className, ...query } = req.query;

  const classes = await Class.find({
    $expr: {
      $gt: [{ $size: "$dates" }, 1],
    },
    ...query,
    ...(className && {
      "className.sl": { $regex: className, $options: "i" },
    }),
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
  const { ageGroup, ...rest } = req.query;

  const query: any = { dates: { $size: 1 }, ...rest };

  if (ageGroup) {
    query.ageGroup = { $in: (ageGroup as string).split(",") };
  }

  const allClasses = await Class.find(query).sort({
    dates: 1,
  });

  const classes = allClasses.filter(
    (el) =>
      new Date(el.dates[0]) >=
      new Date(new Date().setDate(new Date().getDate() - 1))
  );

  res.status(200).json({
    status: "success",
    classes,
  });
});

export const getSingleDateClassesReception = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classes = await Class.find({
    dates: { $size: 1 },
    ...req.query,
  }).sort({
    dates: 1,
  });

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
  const teachers = await Promise.all(
    req.body.teacher.map((id: string) => User.findById(id))
  );

  for (const user of teachers) {
    if (!user) return next(new AppError("User not found", 404));

    if (!user.role.includes("coach") && !req.user.role.includes("admin"))
      return next(new AppError("User is not a coach", 400));
  }

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
    path: "teacher students.student",
    select: "firstName lastName email birthDate",
  });

  if (!currentClass) return next(new AppError("Class not found", 404));

  if (
    currentClass.teacher.toString() !== currentUser.id &&
    !req.user.role.includes("employee") &&
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
      currentClass.students.find(
        (student) => student.student.toString() === currentUser._id.toString()
      )
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

  if (
    req.body.articles.paymentMethod === "online" ||
    req.body.articles.paymentMethod === "paypal"
  ) {
    const lastInvoice = await Invoice.findOne({
      "invoiceData.deviceNo": "BLAGO",
    }).sort({
      "invoiceData.invoiceNo": -1,
    });

    const invoiceData = {
      dateTime: new Date(),
      taxNumber: process.env.BOLDERAJ_TAX_NUMBER,
      issueDateTime: new Date(),
      numberingStructure: "C",
      businessPremiseID: process.env.BUSINESSID as string,
      electronicDeviceID: "BLAGO",
      invoiceNumber: lastInvoice
        ? Number(lastInvoice.invoiceData.invoiceNo) + 1
        : 1,
      invoiceAmount: article.classPriceData.price,
      paymentAmount: article.classPriceData.price,
      taxes: [
        {
          taxRate: article.taxRate * 100,
          taxableAmount: article.classPriceData.price,
          taxAmount:
            article.classPriceData.priceDDV - article.classPriceData.price,
        },
      ],
      operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    };

    const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

    const EOR = await connectWithFURS(JSONInvoice);

    const invoiceDataToSave = {
      paymentDueDate: new Date(),
      buyer: currentUser.id,
      company: req.body.company,
      invoiceData: {
        businessPremises: invoiceData.businessPremiseID,
        deviceNo: invoiceData.electronicDeviceID,
        invoiceNo: invoiceData.invoiceNumber.toString(),
      },
      soldItems: {
        taxRate: article.taxRate,
        taxableAmount: article.classPriceData.price,
        amountWithTax: article.classPriceData.priceDDV,
        quantity: 1,
        item: article.name.sl,
      },
      paymentMethod: req.body.articles.paymentMethod,
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
      invoice,
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
      company: req.body.company,
      items: [
        {
          taxRate: article.taxRate,
          taxableAmount: article.classPriceData.price,
          amountWithTax: article.classPriceData.priceDDV,
          quantity: 1,
          item: article.name.sl,
        },
      ],
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      buyer: req.user._id,
      classes,
    };

    const preInvoice = await PreInvoice.create(preInvoiceData);

    await preInvoice.populate({
      path: "buyer",
      select: "email firstName lastName address postalCode city",
    });

    const buyer = preInvoice.buyer as any;

    const mailOptions = {
      email: preInvoice.buyer ? buyer.email : preInvoice.recepient.email,
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

  if (
    req.body.articles.paymentMethod === "online" ||
    req.body.paymentMethod === "paypal"
  ) {
    const lastInvoice = await Invoice.findOne({
      "invoiceData.deviceNo": "BLAGO",
    }).sort({
      "invoiceData.invoiceNo": -1,
    });

    const invoiceData = {
      dateTime: new Date(),
      taxNumber: process.env.BOLDERAJ_TAX_NUMBER,
      issueDateTime: new Date(),
      numberingStructure: "C",
      businessPremiseID: process.env.BUSINESSID as string,
      electronicDeviceID: "BLAGO",
      invoiceNumber: lastInvoice
        ? Number(lastInvoice.invoiceData.invoiceNo) + 1
        : 1,
      invoiceAmount: article.classPriceData.price,
      paymentAmount: article.classPriceData.price,
      taxes: [
        {
          taxRate: article.taxRate * 100,
          taxableAmount: article.classPriceData.price,
          taxAmount:
            article.classPriceData.priceDDV - article.classPriceData.price,
        },
      ],
      operatorTaxNumber: process.env.BOLDERAJ_TAX_NUMBER!,
    };

    const { JSONInvoice, ZOI } = generateJSONInvoice(invoiceData);

    const EOR = await connectWithFURS(JSONInvoice);

    const invoiceDataToSave = {
      paymentDueDate: new Date(),
      buyer: req.user.id,
      company: req.body.company,
      invoiceData: {
        businessPremises: invoiceData.businessPremiseID,
        deviceNo: invoiceData.electronicDeviceID,
        invoiceNo: invoiceData.invoiceNumber.toString(),
      },
      soldItems: {
        taxRate: article.taxRate,
        taxableAmount: article.classPriceData.price,
        amountWithTax: article.classPriceData.priceDDV,
        quantity: 1,
        item: article.name.sl,
      },
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
      invoice,
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
      company: req.body.company,
      items: [
        {
          taxRate: article.taxRate,
          taxableAmount: article.classPriceData.price,
          amountWithTax: article.classPriceData.priceDDV,
          quantity: 1,
          item: article.name.sl,
        },
      ],
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      buyer: req.user._id,
      classes,
    };

    const preInvoice = await PreInvoice.create(preInvoiceData);

    await preInvoice.populate({
      path: "buyer",
      select: "email firstName lastName address postalCode city",
    });

    const buyer = preInvoice.buyer as any;

    const mailOptions = {
      email: preInvoice.buyer ? buyer.email : preInvoice.recepient.email,
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
    currentUser.role.includes("coach") &&
    currentUser.role.length < 3 &&
    currentUser.id !== currentClass.teacher.toString()
  )
    return next(new AppError("You are not the teacher of this class", 401));

  // if (
  //   !currentClass.dates
  //     .map((date) => date.toString())
  //     .includes(new Date(req.body.date).toString())
  // )
  //   return next(new AppError("Date not found", 404));

  // for (const el of req.body.students) {
  //   for (const student of currentClass.students) {
  //     if (student.student.toString() === el.id) {
  //       student.attendance = [...student.attendance, ...el.dates];
  //     }
  //   }
  // }

  for (const el of req.body.students) {
    for (const student of currentClass.students) {
      if (student.student.toString() === el.id) {
        const existingDates = student.attendance.map((d) =>
          d instanceof Date ? d.toISOString() : d
        );

        const updatedDatesSet = new Set(existingDates);

        for (const date of el.dates) {
          const isoDate = new Date(date).toISOString();
          if (updatedDatesSet.has(isoDate)) {
            updatedDatesSet.delete(isoDate);
          } else {
            updatedDatesSet.add(isoDate);
          }
        }

        student.attendance = Array.from(updatedDatesSet).map(
          (d) => new Date(d)
        );
      }
    }
  }

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
  const dayBefore = new Date().setDate(new Date().getDate() - 1);

  const classes = await Class.find({
    students: { $elemMatch: { student: req.user._id } },
    dates: { $elemMatch: { $gt: dayBefore } },
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

  const dayBefore = new Date().setDate(new Date().getDate() - 1);

  const classes = await Class.find({
    students: { $elemMatch: { student: childId } },
    dates: { $elemMatch: { $gt: dayBefore } },
  }).select("name teacher dates time className");

  res.status(200).json({
    status: "success",
    classes,
  });
});

export const removeUserFromGroup = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classInfo = await Class.findById(req.params.id);

  if (!classInfo) return next(new AppError("Class not found!", 404));

  classInfo.students = classInfo.students.filter(
    (classStudent) => classStudent.student.toString() !== req.body.student
  );

  await classInfo.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    classInfo,
  });
});

export const addUserToGroup = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classInfo = await Class.findById(req.params.id);

  if (!classInfo) return next(new AppError("Class not found!", 404));

  classInfo.students = [
    ...classInfo.students,
    { student: req.body.student, attendance: [] },
  ];

  await classInfo.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    classInfo,
  });
});

export const addCoach = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classInfo = await Class.findById(req.params.id);

  if (!classInfo) return next(new AppError("Class not found!", 404));

  if (Array.isArray(classInfo.teacher)) {
    classInfo.teacher = [...classInfo.teacher, req.body.coach];
  } else {
    classInfo.teacher = [classInfo.teacher, req.body.coach];
  }

  await classInfo.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    classInfo,
  });
});

export const removeCoach = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const classInfo = await Class.findById(req.params.id);

  if (!classInfo) return next(new AppError("Class not found!", 404));

  classInfo.teacher = classInfo.teacher.filter(
    (t) => t.toString() !== req.body.coach
  );

  await classInfo.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    classInfo,
  });
});
