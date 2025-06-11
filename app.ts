import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/userRoutes";
import ticketRouter from "./routes/ticketRoutes";
import visitRouter from "./routes/visitRoutes";
import invoiceRouter from "./routes/invoiceRoutes";
import cashRegisterRecordRouter from "./routes/cashRegisterRecordRoutes";
import classRouter from "./routes/classRoutes";
import preInvoiceRouter from "./routes/preInvoiceRoutes";
import companyRouter from "./routes/companyRoutes";
import articleRouter from "./routes/articleRoutes";
import paymentRouter from "./routes/paymentRoutes";
import giftRouter from "./routes/giftRoutes";
// import discountRouter from "./routes/discountRoutes";
import globalErrorHandler from "./controllers/errorController";
import AppError from "./utils/appError";

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
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/gifts", giftRouter);
// app.use("/api/v1/discounts", discountRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

export default app;
