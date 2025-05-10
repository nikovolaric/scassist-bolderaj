import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController.js";
import {
  createInvoice,
  downloadInvoicePDF,
  downloadInvoices,
  downloadMyInvoice,
  getAllInvoices,
  getMyInvoices,
} from "../controllers/invoiceContoller.js";

const router = Router();

router.use(protect);

router.get("/myinvoices/:year", getMyInvoices);
router.get("/myinvoices/download/:id", downloadMyInvoice);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllInvoices).post(createInvoice);
router.post("/download", downloadInvoices);
router.post("/download/:id", downloadInvoicePDF);

export default router;
