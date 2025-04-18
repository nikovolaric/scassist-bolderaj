import Router from "express";
import { protect } from "../controllers/authController";
import { checkPayment, makePayment } from "../controllers/paymentController";

const router = Router();

router.use(protect);

router.post("/makepayment", makePayment);
router.get("/checkpayment/:id", checkPayment);

export default router;
