import { Router } from "express";
import { protect } from "../controllers/authController";
import { createSession } from "../controllers/paymentController";

const router = Router();

router.use(protect);

router.get("/createsession/:amount", createSession);

export default router;
