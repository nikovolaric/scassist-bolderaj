import { Router } from "express";
import {
  getAllVisits,
  getMyChildVisits,
  getMyVisits,
  getUserVisits,
  getYearlyVisitsNo,
} from "../controllers/visitController";
import { protect, restrictTo } from "../controllers/authController";

const router = Router();

router.use(protect);

router.get("/myvisits", getMyVisits);
router.get("/childvisits/:id", getMyChildVisits);

router.get("/yearly/:year", getYearlyVisitsNo);

router.use(restrictTo(["admin", "employee"]));

router.get("/user/:id", getUserVisits);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllVisits);

export default router;
