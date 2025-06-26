import { NextFunction, Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";
import { createHash } from "crypto";
import { Types } from "mongoose";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import User from "../models/userModel";
import {
  sendChildAuth,
  sendWelcomeConfirmMail,
  sendReset,
  sendAnotherConfirmMail,
} from "../utils/email";

const signToken = function (id: string) {
  const secret: any = process.env.JWT_SECRET;
  return sign({ id }, secret, {
    expiresIn: Number(process.env.JWT_EXPIRES_IN) * 24 * 60 * 60,
  });
};

const createSendToken = function (
  user: { _id: any; password: string | undefined },
  statusCode: number,
  res: Response
) {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() +
        Number(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    sameSite: true,
    secure: true,
  };

  // if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    user,
  });
};

export const signup = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.body.agreesToTerms || !req.body.infoIsTrue)
    return next(
      new AppError(
        "You must provide valid information and agree to our terms!",
        400
      )
    );

  const today = new Date();
  const birthDate = new Date(req.body.birthDate);

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
      new AppError(
        "You must be at least 18 years old to register without a parent!",
        403
      )
    );

  if (age >= 18 && (!req.body.email || !req.body.password))
    return next(new AppError("Please provide email and password", 400));

  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    birthDate: req.body.birthDate,
    phoneNumber: req.body.phoneNumber,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    agreesToTerms: req.body.agreesToTerms,
    infoIsTrue: req.body.infoIsTrue,
    signedForNewsletter: req.body.signedForNewsletter,
    address: req.body.address,
    city: req.body.city,
    postalCode: req.body.postalCode,
    country: req.body.country,
    parentContact: req.body.parentContact,
    role: ["user"],
  });

  if (!newUser) return next(new AppError("Something went wrong!", 404));

  const token = newUser.createConfirmMailToken();
  await newUser.save({ validateBeforeSave: false });

  await sendWelcomeConfirmMail({ email: req.body.email, token });

  res.status(201).json({
    status: "success",
    user: newUser,
  });
});

export const sendNewConfirmMail = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id);

  if (!user) return next(new AppError("User not found.", 401));

  const token = user.createConfirmMailToken();
  await user.save({ validateBeforeSave: false });

  await sendAnotherConfirmMail({ email: req.body.email, token });

  res.status(200).json({
    status: "success",
  });
});

export const confirmMail = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get user based on the token
  const hashedToken = createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    confirmMailToken: hashedToken,
    confirmMailTokenExpires: { $gt: Date.now() },
  });

  //2. If token has not expired, and there is user, set new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  //3. Update confirmMail property for the user
  user.confirmMailToken = undefined;
  user.confirmMailTokenExpires = undefined;

  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
  });
});

export const createChild = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await User.findById(req.user.id).populate({
    path: "parentOf.child",
    select: "firstName",
  });

  if (!user) return next(new AppError("User not found", 404));

  if (!req.body.agreesToTerms || !req.body.infoIsTrue)
    return next(
      new AppError(
        "You must provide valid information and agree to our terms!",
        400
      )
    );

  if (
    //@ts-ignore
    user.parentOf.filter((el) => el.child.firstName === req.body.firstName)
      .length > 0
  )
    return next(new AppError("Child already exists.", 404));

  const today = new Date();
  const birthDate = new Date(req.body.birthDate);

  let age: number = today.getFullYear() - birthDate.getFullYear();

  if (
    today.getMonth() - birthDate.getMonth() < 0 ||
    (today.getMonth() - birthDate.getMonth() === 0 &&
      today.getDate() - birthDate.getDate() < 0)
  ) {
    age--;
  }

  if (age >= 18)
    return next(
      new AppError("You must register alone, with signup function!", 403)
    );

  const child = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    birthDate: req.body.birthDate,
    agreesToTerms: req.body.agreesToTerms,
    address: req.body.address,
    city: req.body.city,
    postalCode: req.body.postalCode,
    country: req.body.country,
    parentContact: {
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
    parent: user._id,
    role: ["user"],
  });

  user.parentOf = [
    ...user.parentOf,
    {
      child: child._id as Types.ObjectId,
      agreesToTerms: req.body.agreesToTerms as boolean,
      infoIsTrue: req.body.infoIsTrue as boolean,
      signedAt: new Date(),
    },
  ];
  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
    child,
  });
});

export const sendChildAuthData = catchAsync(async function (
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
  if (!child) {
    return next(new AppError("User does not exist.", 404));
  }

  if (child.age < 15)
    return next(
      new AppError(
        "A child must be at least 15 years old to use this app alone!",
        401
      )
    );

  const authToken = child?.createChildAuthToken();
  await child.save({ validateBeforeSave: false });

  try {
    await sendChildAuth({
      email: req.body.email,
      token: authToken,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    child.childAuthToken = undefined;
    child.childAuthTokenExpires = undefined;
    await child.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email! Please try again later",
        500
      )
    );
  }
});

export const setChildAuthData = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get user based on the token
  const hashedToken = createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const child = await User.findOne({
    childAuthToken: hashedToken,
    childAuthTokenExpires: { $gt: Date.now() },
  });

  //2. If token has not expired, and there is user, set new password
  if (!child) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  child.email = req.body.email;
  child.password = req.body.password;
  child.passwordConfirm = req.body.passwordConfirm;
  child.phoneNumber = req.body.phoneNumber;
  child.childAuthToken = undefined;
  child.childAuthTokenExpires = undefined;
  await child.save();

  //3. Update changedPasswordAt property for the user
  res.status(201).json({
    status: "success",
  });
});

export const login = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { email, password } = req.body;
  //1. Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide username and password", 400));
  }

  //2. Check if the user exists && password is correct
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect username or password", 401));
  }

  //3. If everything is ok, send token to client
  createSendToken(user, 200, res);
});

export const logout = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.clearCookie("jwt");

  res.status(200).json({
    status: "success",
  });
});

export const protect = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get token and check if it's there

  const token = req.cookies.jwt;

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access!", 401)
    );
  }
  //2. Verify token
  const secret: any = process.env.JWT_SECRET;

  // const decoded = await promisify(verify);
  const decoded: any = verify(token, secret);

  // //3. Check if user exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    res.cookie("jwt", "", {
      expires: new Date(Date.now() + 1000),
      httpOnly: true,
    });
    return next(new AppError("The user no longer exists", 401));
  }
  //4. Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again", 401)
    );
  }

  req.user = currentUser;

  next();
});

export const restrictTo = function (roles: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const rolesMatch = roles.some((role) => req.user.role.includes(role));

    if (!rolesMatch) {
      return next(
        new AppError("You do not have premisson to perform this action", 403)
      );
    }
    next();
  };
};

export const forgotPassword = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with that email adress", 404));
  }
  //2. Generate the radom reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //3. Send it back as and email
  try {
    await sendReset({
      email: user.email,
      token: resetToken,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email! Please try again later",
        500
      )
    );
  }
});

export const resetPassword = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get user based on the token
  const hashedToken = createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //2. If token has not expired, and there is user, set new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  //3. Update changedPasswordAt property for the user
});

export const updatePassword = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get the user from collection
  const user = await User.findById(req.user.id).select("+password");
  //2. Check if POSTed current password is correct
  if (!user) return;

  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError("Your current password is wrong", 401));
  }

  // 3. If so, update password
  user.password = req.body.password;
  // user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // //4. Log user in, send JWT
  createSendToken(user, 200, res);
});

// export const protectIP = catchAsync(async function (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) {
//   const response: any = await fetch("https://ipinfo.io/json");
//   const { ip } = await response.json();

//   if (ip !== process.env.ALLOWED_IP)
//     return next(
//       new AppError(
//         "You are not allowed to access this route from your device",
//         401
//       )
//     );

//   next();
// });
