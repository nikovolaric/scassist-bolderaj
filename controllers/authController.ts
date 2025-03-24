import { NextFunction, Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import User from "../models/userModel";
import { sendReset } from "../utils/email";
import { createHash } from "crypto";

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
  if (!req.body.agreesToTerms)
    return next(new AppError("You must agree to terms and conditions", 400));

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

  if (age < 18 && !req.body.childActivationCode)
    return next(
      new AppError(
        "You must be at least 18 years old to register without a parent activation code!",
        403
      )
    );

  const parent = await User.findOne({
    "childActivationCode.code": req.body.childActivationCode,
  });

  if (!parent && age < 18)
    return next(new AppError("Activation code not valid", 400));

  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    birthDate: req.body.birthDate,
    phoneNumber: req.body.phoneNumber,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    agreesToTerms: req.body.agreesToTerms,
    signedForNewsletter: req.body.signedForNewsletter,
    address: req.body.address,
    city: req.body.city,
    postalCode: req.body.postalCode,
    country: req.body.country,
    role: ["user"],
  });

  if (parent?.childActivationCode && age < 18) {
    parent.parentOf = [
      ...parent.parentOf,
      {
        child: newUser.id,
        agreesToTerms: true,
        signedAt: parent.childActivationCode.signedAt,
      },
    ];
    parent.childActivationCode = undefined;

    newUser.parentContact = {
      phoneNumber: parent.phoneNumber,
      email: parent.email,
    };

    await newUser.save({ validateBeforeSave: false });
    await parent.save({ validateBeforeSave: false });
  }

  if (req.body.email) {
    createSendToken(newUser, 201, res);
  }
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

export const protect = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  //1. Get token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

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
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/users/resetpassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and password Confirm to: ${resetURL},\nIf you didn't forget your password, please ignore this email`;

  try {
    await sendReset({
      email: user.email,
      subject: "Your password reset token (valid for 10 minutes)",
      message,
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
  // user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  //3. Update changedPasswordAt property for the user
  //4. Lof the user in, send JWT
  createSendToken(user, 200, res);
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

export const protectIP = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const response = await fetch("https://ipinfo.io/json");
  const { ip } = await response.json();

  if (ip !== process.env.COMPUTER_IP)
    return next(
      new AppError(
        "You are not allowed to access this route from your device",
        401
      )
    );

  next();
});
