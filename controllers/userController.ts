import { NextFunction, Request, Response } from "express";
import User from "../models/userModel";
import { getAll, getOne } from "./handlerFactory";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { generateRandomString } from "../utils/helpers";

export const getUser = getOne(User, {
  select: "-__v -role -passwordChangedAt",
});
export const getAllUsers = getAll(User);

export const getMe = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const me = await User.findById(req.user.id);

  if (!me) return next(new AppError("Please log in", 401));

  if (me.usedTickets.length > 0 || me.unusedTickets.length > 0) {
    await me.populate({
      path: "unusedTickets usedTickets",
      select: "-user -__v -used",
      strictPopulate: false,
    });
  }

  if (me.visits.length > 0) {
    await me.populate({
      path: "visits",
      select: "-user -__v",
      strictPopulate: false,
    });
  }

  res.status(200).json({
    status: "success",
    me,
  });
});

export const updateUsersRole = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.params.id);

  if (!user) return next(new AppError("User not found", 404));
  if (
    (req.body.role === "employee" ||
      req.body.role === "admin" ||
      req.body.role === "employee/coach") &&
    (!req.body.taxNo || !req.body.invoiceNickname)
  ) {
    return next(
      new AppError(
        "You must provide role, tax number and invoice nickname",
        400
      )
    );
  }

  if (req.body.role === "coach") {
    user.role = req.body.role;
  }

  if (
    (req.body.role === "employee" ||
      req.body.role === "admin" ||
      req.body.role === "employee/coach") &&
    req.body.taxNo &&
    req.body.invoiceNickname
  ) {
    user.canInvoice = true;
    user.taxNo = req.body.taxNo;
    user.role = req.body.role;
    user.invoiceNickname = req.body.invoiceNickname;
  }

  user.updatedAt = new Date();

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    user,
  });
});

const filterObj = (obj: any, ...allowedFields: string[]) => {
  const newObj: { [key: string]: any } = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

export const updateMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Create error if user POSTs password data
    if (req.body.password || req.body.passwordConfirm) {
      return next(
        new AppError(
          "This route is not for password updates. Please use /updateMyPassword.",
          400
        )
      );
    }

    // 2) Filtered out unwanted fields names that are not allowed to be updated
    const filteredBody = filterObj(req.body, "firstName", "lastName", "role");

    // 3) Update user document
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      filteredBody,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      status: "success",
      data: {
        user: updatedUser,
      },
    });
  }
);

export const deleteMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
      status: "success",
      data: null,
    });
  }
);

export const createChildCode = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const me = await User.findById(req.user.id);

  if (!me) return next(new AppError("User does not exist!", 404));

  const today = new Date();
  const birthDate = new Date(me.birthDate);

  let age: number = today.getFullYear() - birthDate.getFullYear();

  if (
    today.getMonth() - birthDate.getMonth() < 0 ||
    (today.getMonth() - birthDate.getMonth() === 0 &&
      today.getDate() - birthDate.getDate() < 0)
  ) {
    age--;
  }

  if (age < 18)
    return next(
      new AppError("You must be at least 18 to access this route!", 404)
    );

  me.childActivationCode = {
    code: generateRandomString(8),
    signedAt: new Date(),
  };

  await me.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
    childActivationCode: me.childActivationCode,
  });
});

export const getMyChildren = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const me = await User.findById(req.user.id).populate({
    path: "parentOf.child",
  });

  res.status(200).json({
    status: "success",
    children: me?.parentOf,
  });
});

export const getMyOneChild = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const myChild = await User.findById(req.params.id);

  if (!myChild) return next(new AppError("User does not exist", 404));

  const children = req.user.parentOf.filter(
    (child) => child.child.toString() === myChild.id
  );

  if (children.length === 0)
    return next(new AppError("This is not your child", 403));

  res.status(200).json({
    status: "success",
    myChild,
  });
});
