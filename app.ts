import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/userRoutes.js";
import ticketRouter from "./routes/ticketRoutes.js";
import visitRouter from "./routes/visitRoutes.js";
import invoiceRouter from "./routes/invoiceRoutes.js";
import cashRegisterRecordRouter from "./routes/cashRegisterRecordRoutes.js";
import classRouter from "./routes/classRoutes.js";
import preInvoiceRouter from "./routes/preInvoiceRoutes.js";
import companyRouter from "./routes/companyRoutes.js";
import articleRouter from "./routes/articleRoutes.js";
// import discountRouter from "./routes/discountRoutes.js";
import globalErrorHandler from "./controllers/errorController.js";
import AppError from "./utils/appError.js";

const app = express();

//Body parser, reading data from body into req.body
app.use(express.json({ limit: "10kb" }));

app.use(
  cors({
    origin: ["http://localhost:5173", "https://test.bolderaj.si"],
    credentials: true,
  })
);
app.use(cookieParser());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/tickets", ticketRouter);
app.use("/api/v1/visits", visitRouter);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/cashregister", cashRegisterRecordRouter);
app.use("/api/v1/classes", classRouter);
app.use("/api/v1/preinvoices", preInvoiceRouter);
app.use("/api/v1/companies", companyRouter);
app.use("/api/v1/articles", articleRouter);
app.use("/api/v1/articles", articleRouter);
// app.use("/api/v1/discounts", discountRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

export default app;
