import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  createCompany,
  getAllCompanies,
  getCompany,
} from "../controllers/companyController";

const router = Router();

router.use(protect);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllCompanies).post(createCompany);
router.route("/:id").get(getCompany);

export default router;
