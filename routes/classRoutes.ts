import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController.js";
import {
  checkAttendance,
  createClass,
  deleteClass,
  getAllClasses,
  getChildClasses,
  getMultipleDateClasses,
  getMyClasses,
  getOneClass,
  getSingleDateClasses,
  signUpChildForClassOnline,
  signUpForClassOnline,
  updateClass,
} from "../controllers/classController.js";

const router = Router();

router.use(protect);

router.get("/myclasses", getMyClasses);
router.get("/multipledates", getMultipleDateClasses);
router.get("/singledates", getSingleDateClasses);

router.post("/signuponline", signUpForClassOnline);
router.post("/child/signuponline/:id", signUpChildForClassOnline);
router.get("/child/getclasses/:id", getChildClasses);

router.get("/:id", getOneClass);

router.post(
  "/checkattendance/:id",
  restrictTo(["admin", "coach", "employee"]),
  checkAttendance
);

router.use(restrictTo(["admin"]));
router.route("/").get(getAllClasses).post(createClass);
router.route("/:id").patch(updateClass).delete(deleteClass);

export default router;
