import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  createInvoice,
  downloadInvoicePDF,
  downloadInvoices,
  getAllInvoices,
  getMyInvoices,
} from "../controllers/invoiceContoller";

const router = Router();

router.use(protect);

router.get("/myinvoices", getMyInvoices);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllInvoices).post(createInvoice);
router.post("/download", downloadInvoices);
router.post("/download/:id", downloadInvoicePDF);

export default router;
