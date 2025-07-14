import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  confirmFiscalInvoiceLater,
  createInvoice,
  downloadInvoicePDF,
  downloadInvoices,
  downloadMyInvoice,
  echoFiscal,
  getAllInvoices,
  getInvoicesTotalSum,
  getMyInvoices,
  issueEmptyInvoice,
  myIssuedInvoices,
  registerPremise,
  stornoInvoice,
  stornoInvoiceReception,
  updateInvoice,
} from "../controllers/invoiceContoller";

const router = Router();

router.use(protect);

router.get("/myinvoices/:year", getMyInvoices);
router.get("/myinvoices/download/:id", downloadMyInvoice);

router.use(restrictTo(["admin", "employee"]));

router.get("/myissuedtoday", myIssuedInvoices);
router.get("/download/:id", downloadInvoicePDF);
router.post("/stornoreception/:id", stornoInvoiceReception);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllInvoices).post(createInvoice);
router.get("/userinvoices/:id");
router.post("/download", downloadInvoices);
router.get("/totalamountsum", getInvoicesTotalSum);

router.post("/confirmfiscal/:id", confirmFiscalInvoiceLater);

router.post("/premise", registerPremise);
router.post("/fiscalecho", echoFiscal);
router.post("/issueempty", issueEmptyInvoice);
router.post("/storno/:id", stornoInvoice);

router.route("/:id").patch(updateInvoice);

export default router;
