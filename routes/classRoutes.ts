import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  addUserToGroup,
  checkAttendance,
  createClass,
  deleteClass,
  getAllClasses,
  getChildClasses,
  getMultipleDateClasses,
  getMyClasses,
  getOneClass,
  getSingleDateClasses,
  getSingleDateClassesReception,
  removeUserFromGroup,
  signUpChildForClassOnline,
  signUpForClassOnline,
  updateClass,
} from "../controllers/classController";
import { checkPayment } from "../controllers/paymentController";

const router = Router();

router.use(protect);

router.get("/myclasses", getMyClasses);
router.get("/multipledates", getMultipleDateClasses);
router.get("/singledates", getSingleDateClasses);

router.post("/signuponline", checkPayment, signUpForClassOnline);
router.post("/child/signuponline/:id", checkPayment, signUpChildForClassOnline);
router.get("/child/getclasses/:id", getChildClasses);

router.post(
  "/checkattendance/:id",
  restrictTo(["admin", "coach", "employee"]),
  checkAttendance
);
router.get(
  "/singledatesreception",
  restrictTo(["admin", "employee"]),
  getSingleDateClassesReception
);

router.get("/:id", getOneClass);

router.use(restrictTo(["admin"]));
router.route("/").get(getAllClasses).post(createClass);
router.route("/:id").patch(updateClass).delete(deleteClass);
router.patch("/:id/removeuser", removeUserFromGroup);
router.patch("/:id/addUser", addUserToGroup);

export default router;
