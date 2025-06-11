import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  generateGiftCodes,
  getAllGifts,
  getOneGift,
  useGift,
} from "../controllers/giftControler";

const router = Router();

router.use(protect);

router.get("/", restrictTo(["admin", "employee"]), getAllGifts);
router.get("/:id", restrictTo(["admin", "employee"]), getOneGift);
router.post("/:id/usegift", restrictTo(["admin", "employee"]), useGift);

router.use(restrictTo(["admin"]));

router.post("/generatecodes", generateGiftCodes);

export default router;
