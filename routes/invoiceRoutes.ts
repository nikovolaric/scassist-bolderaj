import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  confirmFiscalInvoiceLater,
  createInvoice,
  downloadInvoicePDF,
  downloadInvoices,
  downloadMyInvoice,
  getAllInvoices,
  getMyInvoices,
  myIssuedInvoices,
} from "../controllers/invoiceContoller";

const router = Router();

router.use(protect);

router.get("/myinvoices/:year", getMyInvoices);
router.get("/myinvoices/download/:id", downloadMyInvoice);

router.use(restrictTo(["admin", "employee"]));

router.get("/myissuedtoday", myIssuedInvoices);
router.get("/download/:id", downloadInvoicePDF);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllInvoices).post(createInvoice);
router.get("/userinvoices/:id");
router.post("/download", downloadInvoices);

router.post("/confirmfiscal/:id", confirmFiscalInvoiceLater);

export default router;
