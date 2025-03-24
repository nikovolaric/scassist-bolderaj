import { Router } from "express";
import { protect, restrictTo } from "../controllers/authController";
import {
  checkAttendance,
  createClass,
  deleteClass,
  getAllClasses,
  getMyClasses,
  getOneClass,
  signUpChildForClassOnline,
  signUpForClassOnline,
  updateClass,
} from "../controllers/classController";

const router = Router();

router.use(protect);

router.get("/myclasses", getMyClasses);

router.post("/signuponline/:id", signUpForClassOnline);
router.post("/child/signuponline/:id", signUpChildForClassOnline);

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
