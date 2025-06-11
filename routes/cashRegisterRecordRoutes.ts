import { Router } from "express";
import { protect, protectIP, restrictTo } from "../controllers/authController";
import {
  deleteCashRegisterRecord,
  endCashRegisterRecord,
  getAllCashRegisterRecords,
  getCashRegisterRecord,
  getOneCashRegisterRecord,
  protectCR,
  startCashRegisterRecord,
  updateCashRegisterRecord,
} from "../controllers/cashRegisterRecordController";

const router = Router();

router.use(protect);
router.use(restrictTo(["admin", "employee"]));

router.post("/start", startCashRegisterRecord);
router.get("/get", protectCR, getCashRegisterRecord);
router.post("/end", protectCR, endCashRegisterRecord);

router.use(restrictTo(["admin"]));

router.get("/", getAllCashRegisterRecords);

router
  .route("/:id")
  .get(getOneCashRegisterRecord)
  .patch(updateCashRegisterRecord)
  .delete(deleteCashRegisterRecord);

export default router;
