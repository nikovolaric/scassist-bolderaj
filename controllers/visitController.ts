import { NextFunction, Request, Response } from "express";
import Visit from "../models/visitModel";
import catchAsync from "../utils/catchAsync";
import { getAll } from "./handlerFactory";
import APIFeatures from "../utils/apiFeatures";
import AppError from "../utils/appError";
import {
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Workbook } from "exceljs";
import Company from "../models/companyModel";

export const getAllVisits = getAll(Visit);

export const getMyVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const features = new APIFeatures(
    Visit.find({ user: req.user.id }).populate({
      path: "ticket",
      select: "name",
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const visits = await features.query;

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});

export const getMyChildVisits = catchAsync(async function (
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

  const features = new APIFeatures(
    Visit.find({ user: childId }).populate({
      path: "ticket",
      select: "name",
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const visits = await features.query;

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});

export const getYearlyVisitsNo = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const year = req.params.year;

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const visits = await Visit.find({
    date: { $gte: startDate, $lte: endDate },
    user: req.user._id,
  });

  res.status(200).json({
    status: "success",
    results: visits.length,
  });
});

export const getUserVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const visits = await Visit.find({ user: req.params.id })
    .populate({ path: "ticket", select: "name" })
    .sort({ date: -1 })
    .limit(10);

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});

export const getLastVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = new Date(req.body.date);

  const visits = await Visit.find({
    date: {
      $gte: startOfDay(now),
      $lte: endOfDay(now),
    },
  })
    .populate({ path: "ticket user", select: "name firstName lastName" })
    .sort({ date: -1 });

  res.status(200).json({
    status: "success",
    results: visits.length,
    visits,
  });
});

export const getDailyVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = new Date();

  const visits = await Visit.find({
    date: {
      $gte: startOfDay(now),
      $lte: endOfDay(now),
    },
  });

  const intervals = [
    {
      label: "09:00–11:00",
      start: setMinutes(setHours(now, 9), 0),
      end: setMinutes(setHours(now, 11), 0),
    },
    {
      label: "11:00–15:00",
      start: setMinutes(setHours(now, 11), 0),
      end: setMinutes(setHours(now, 15), 0),
    },
    {
      label: "15:00–18:00",
      start: setMinutes(setHours(now, 15), 0),
      end: setMinutes(setHours(now, 18), 0),
    },
    {
      label: "18:00–22:00",
      start: setMinutes(setHours(now, 18), 0),
      end: setMinutes(setHours(now, 22), 0),
    },
  ];

  const groupedVisits = intervals.map((interval) => {
    const count = visits.filter((visit) =>
      isWithinInterval(new Date(visit.date), {
        start: interval.start,
        end: interval.end,
      })
    ).length;

    return {
      timeRange: interval.label,
      visitCount: count,
    };
  });

  res.status(200).json({
    status: "success",
    groupedVisits,
  });
});

export const getDailyVisitsStats = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = new Date(req.body.date);

  const visits = await Visit.find({
    date: {
      $gte: startOfDay(now),
      $lte: endOfDay(now),
    },
  });

  const intervals = [
    {
      label: "09:00–11:00",
      start: setMinutes(setHours(now, 9), 0),
      end: setMinutes(setHours(now, 11), 0),
    },
    {
      label: "11:00–15:00",
      start: setMinutes(setHours(now, 11), 0),
      end: setMinutes(setHours(now, 15), 0),
    },
    {
      label: "15:00–18:00",
      start: setMinutes(setHours(now, 15), 0),
      end: setMinutes(setHours(now, 18), 0),
    },
    {
      label: "18:00–22:00",
      start: setMinutes(setHours(now, 18), 0),
      end: setMinutes(setHours(now, 22), 0),
    },
  ];

  const groupedVisits = intervals.map((interval) => {
    const count = visits.filter((visit) =>
      isWithinInterval(new Date(visit.date), {
        start: interval.start,
        end: interval.end,
      })
    ).length;

    return {
      timeRange: interval.label,
      visitCount: count,
    };
  });

  res.status(200).json({
    status: "success",
    groupedVisits,
  });
});

export const getMonthlyVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = new Date(req.body.date);

  const visits = await Visit.find({
    date: {
      $gte: startOfMonth(now),
      $lte: endOfMonth(now),
    },
  });

  const hourlyStats = Array.from({ length: 13 }, (_, hour) => {
    const count = visits.filter((visit) => {
      const visitHour = new Date(visit.date).getHours();
      return visitHour === hour + 9;
    }).length;

    return {
      timeRange: `${String(hour + 9).padStart(2, "0")}:00–${String(
        (hour + 10) % 24
      ).padStart(2, "0")}:00`,
      visitCount: count,
    };
  });

  res.status(200).json({
    status: "success",
    hourlyStats,
  });
});

export const exportCompanyVisits = catchAsync(async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const company = await Company.findById(req.params.companyId);

  if (!company) return next(new AppError("Company does not exists!", 404));

  const visits = await Visit.find({ company: req.params.companyId }).sort({
    date: -1,
  });

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(`Obiski ${company.companyName}`);

  worksheet.columns = [
    { header: "Datum", key: "date", width: 25 },
    { header: "Ime uporabnika", key: "fullName", width: 30 },
    { header: "Rojstni datum uporabnika", key: "birthDate", width: 20 },
  ];

  visits.forEach((visit: any) => {
    worksheet.addRow({
      date: visit.date.toLocaleDateString("sl-SI", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      fullName: visit.user?.fullName ?? "",
      birthDate: visit.user?.birthDate
        ? new Date(visit.user.birthDate).toLocaleDateString("sl-SI")
        : "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  const fileName = `Obiski-${company.companyName}.xlsx`;

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${encodeURIComponent(fileName)}`
  );

  res.end(buffer);
});
