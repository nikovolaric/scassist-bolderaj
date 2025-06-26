import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  checkPayedPreInvoices,
  createInvoiceFromPreInvoice,
  createInvoiceFromPreInvoiceReception,
  createPreInvoice,
  deletePreInvoice,
  downloadMyPreInvoice,
  downloadPreInvoiceFromClass,
  downloadPreInvoiceReception,
  getMyUnpaidPreInvoices,
  getUserUnpaidPreinvoices,
} from "../controllers/preInvoiceController";
import multer from "multer";

const router = Router();

router.use(protect);

router.get("/myunpaid", getMyUnpaidPreInvoices);
router.get("/download/class/:classId", downloadPreInvoiceFromClass);
router.get("/download/:id", downloadMyPreInvoice);

router.use(restrictTo(["admin", "employee"]));

router.get("/user/:id", getUserUnpaidPreinvoices);
router.get("/downloadreception/:id", downloadPreInvoiceReception);
router.post(
  "/createinvoicereception/:id",
  createInvoiceFromPreInvoiceReception
);

router.use(restrictTo(["admin"]));

router.route("/").post(createPreInvoice);
router.route("/:id").delete(deletePreInvoice);
router.post("/createinvoice/:id", createInvoiceFromPreInvoice);

const upload = multer({
  storage: multer.memoryStorage(), // Shranjevanje v RAM (brez pisanja na disk)
  limits: { fileSize: 10 * 1024 * 1024 }, // Omejitev velikosti na 10 MB
});

router.post("/checkpayed", upload.single("file"), checkPayedPreInvoices);

export default router;
