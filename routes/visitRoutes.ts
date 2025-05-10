import { Router } from "express";
import {
  getAllVisits,
  getMyChildVisits,
  getMyVisits,
  getYearlyVisitsNo,
} from "../controllers/visitController.js";
import { protect, restrictTo } from "../controllers/authController.js";

const router = Router();

router.use(protect);

router.get("/myvisits", getMyVisits);
router.get("/childvisits/:id", getMyChildVisits);

router.get("/yearly/:year", getYearlyVisitsNo);
router.use(restrictTo(["admin"]));

router.route("/").get(getAllVisits);

export default router;
