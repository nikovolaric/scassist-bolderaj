import { Router } from "express";
import { getAllVisits, getMyVisits } from "../controllers/visitController";
import { protect, restrictTo } from "../controllers/authController";

const router = Router();

router.use(protect);

router.get("/myvisits", getMyVisits);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllVisits);

export default router;
