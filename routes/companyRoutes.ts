import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  createCompany,
  getAllCompanies,
  getCompany,
  useCompanyTicket,
} from "../controllers/companyController";

const router = Router();

router.use(protect);

router.use(restrictTo(["employee", "admin"]));

router.post("/:id/usetickets", useCompanyTicket);

router.route("/").get(getAllCompanies).post(createCompany);
router.route("/:id").get(getCompany);

export default router;
