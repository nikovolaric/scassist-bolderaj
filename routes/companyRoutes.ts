import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController.js";
import {
  createCompany,
  getAllCompanies,
  getCompany,
} from "../controllers/companyController.js";

const router = Router();

router.use(protect);

router.use(restrictTo(["admin"]));

router.route("/").get(getAllCompanies).post(createCompany);
router.route("/:id").get(getCompany);

export default router;
