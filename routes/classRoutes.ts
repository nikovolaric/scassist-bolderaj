import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  addCoach,
  addReplacement,
  addUserToGroup,
  checkAttendance,
  createClass,
  deleteClass,
  deleteReplacement,
  getAllClasses,
  getChildClasses,
  getMultipleDateClasses,
  getMyClasses,
  getOneClass,
  getSingleDateClasses,
  getSingleDateClassesReception,
  removeCoach,
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
router.patch("/:id/addReplacement", addReplacement);
router.patch("/:id/deleteReplacement", deleteReplacement);
router.patch("/:id/removeuser", removeUserFromGroup);
router.patch("/:id/addUser", addUserToGroup);
router.patch("/:id/addcoach", addCoach);
router.patch("/:id/removecoach", removeCoach);

export default router;
