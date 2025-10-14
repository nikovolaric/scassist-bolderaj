import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  addUser,
  companyChanges,
  createCompany,
  deleteCompany,
  getAllCompanies,
  getCompany,
  removeUser,
  updateCompany,
  useCompanyTicket,
} from "../controllers/companyController";

const router = Router();

router.use(protect);

router.use(restrictTo(["employee", "admin"]));

router.post("/:id/usetickets", useCompanyTicket);

router.get("/", getAllCompanies);
router.route("/:id").get(getCompany);

router.use(restrictTo(["admin"]));

router.route("/").post(createCompany);
router.route("/:id").patch(updateCompany).delete(deleteCompany);
router.get("/getchanges/:id", companyChanges);
router.post("/:id/removeuser/:userid", removeUser);
router.post("/:id/adduser/:userid", addUser);

export default router;
