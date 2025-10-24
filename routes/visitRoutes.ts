import { Router } from "express";
import {
  exportCompanyVisits,
  getAllVisits,
  getCurrentVisitsStreak,
  getDailyVisits,
  getDailyVisitsStats,
  getLastVisits,
  getMonthlyVisits,
  getMyChildVisits,
  getMyVisits,
  getTotalYearlyVisits,
  getUserVisits,
  getYearlyVisitsNo,
} from "../controllers/visitController";
import { protect, restrictTo } from "../controllers/authController";

const router = Router();

router.use(protect);

router.get("/myvisits", getMyVisits);
router.get("/childvisits/:id", getMyChildVisits);

router.post("/yearly", getYearlyVisitsNo);

router.use(restrictTo(["admin", "employee"]));

router.get("/user/:id", getUserVisits);
router.get("/dailyvisits", getDailyVisits);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllVisits);
router.get("/getmystreak", getCurrentVisitsStreak);
router.post("/dailyvisitsstats", getDailyVisitsStats);
router.post("/monthlyvisitsstats", getMonthlyVisits);
router.post("/lastvisits", getLastVisits);
router.post("/gettotalyearly", getTotalYearlyVisits);
router.get("/:companyId/exportexcel", exportCompanyVisits);

export default router;
