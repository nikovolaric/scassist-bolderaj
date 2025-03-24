import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  createDiscount,
  deleteDiscount,
  getAllDiscounts,
  getOneDiscount,
  updateDiscount,
} from "../controllers/discountController";

const router = Router();

router.use(protect);
router.use(restrictTo(["admin"]));

router.route("/").get(getAllDiscounts).post(createDiscount);
router
  .route("/:id")
  .get(getOneDiscount)
  .patch(updateDiscount)
  .delete(deleteDiscount);

export default router;
