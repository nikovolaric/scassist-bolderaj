import { Router } from "express";
import {
  getAllUsers,
  getUser,
  getMe,
  updateUsersRole,
  updateMe,
  deleteMe,
  createChildCode,
  getMyChildren,
  getMyOneChild,
} from "../controllers/userController";
import {
  forgotPassword,
  login,
  protect,
  resetPassword,
  restrictTo,
  signup,
  updatePassword,
} from "../controllers/authController";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

router.post("/forgotpassword", forgotPassword);
router.patch("/resetpassword/:token", resetPassword);

router.use(protect);

router.patch("/updatepassword", updatePassword);
router.get("/getme", getMe);
router.patch("/updateme", updateMe);
router.delete("/deleteme", deleteMe);
router.post("/createchildcode", createChildCode);
router.get("/getmychildren", getMyChildren);
router.get("/getmychildren/:id", getMyOneChild);

router.use(restrictTo(["admin", "employee"]));

router.get("/", getAllUsers);
router.route("/:id").get(getUser);

router.use(restrictTo(["admin"]));
router.post("/updaterole/:id", updateUsersRole);

export default router;
