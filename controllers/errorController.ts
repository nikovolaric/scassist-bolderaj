import { NextFunction, Response, Request } from "express";
import AppError from "../utils/appError.js";

interface iErr {
  path: string;
  value: number;
  status: number | string;
  statusCode: number;
  keyValue: {
    name: string;
  };
  errors: {
    message: string;
  }[];
  message: string;
  stack: string;
  isOperational: boolean;
  name: string;
}

const handleCastErrorDB = function (err: iErr) {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = function (err: iErr) {
  const value = err.keyValue.name;
  const message = `Duplicate field value "${value}". Please use another field`;
  return new AppError(message, 400);
};

const handleValidatorErrorDB = function (err: iErr) {
  const errors = Object.values(err.errors).map((el) => el.message);

  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError("Invalid token! Please login again", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token expired! Please login again", 401);

const sendErrorDev = function (err: iErr, res: Response) {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = function (err: iErr, res: Response) {
  // Operational, trusted error: send to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });

    //Programming or other unknown error: don't want to leak anything to the client
  } else {
    //1) Log error
    console.error("ERROR", err);

    // 2) Send generic message
    res.status(500).json({
      status: "error",
      message: "Something went very wrong",
    });
  }
};

function errorHandlerFunction(
  err: iErr,
  req: Request,
  res: Response,
  next: NextFunction
) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    let error: any = { ...err, name: err.name };

    if (error.name === "CastError") error = handleCastErrorDB(error);

    if (error.code === 11000) error = handleDuplicateFieldsDB(error);

    if (error.name === "ValidationError") error = handleValidatorErrorDB(error);

    if (error.name === "JsonWebTokenError") error = handleJWTError();

    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
}

export default errorHandlerFunction;
