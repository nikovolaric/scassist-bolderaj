import { Router } from "express";
import {
  protect,
  protectIP,
  restrictTo,
} from "../controllers/authController.js";
import {
  deleteCashRegisterRecord,
  endCashRegisterRecord,
  getAllCashRegisterRecords,
  getOneCashRegisterRecord,
  startCashRegisterRecord,
  updateCashRegisterRecord,
} from "../controllers/cashRegisterRecordController.js";

const router = Router();

router.use(protect);
router.use(restrictTo(["admin", "employee"]));

router.post("/start", protectIP, startCashRegisterRecord);
router.post("/end", protectIP, endCashRegisterRecord);

router.use(restrictTo(["admin"]));

router.get("/", getAllCashRegisterRecords);

router
  .route("/:id")
  .get(getOneCashRegisterRecord)
  .patch(updateCashRegisterRecord)
  .delete(deleteCashRegisterRecord);

export default router;
