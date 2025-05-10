import { Router } from "express";
import {
  getAllUsers,
  getUser,
  getMe,
  updateUsersRole,
  updateMe,
  deleteMe,
  getMyChildren,
  getMyOneChild,
  createMyChildLoginInfo,
} from "../controllers/userController.js";
import {
  confirmMail,
  createChild,
  forgotPassword,
  login,
  logout,
  protect,
  resetPassword,
  restrictTo,
  sendChildAuthData,
  sendNewConfirmMail,
  setChildAuthData,
  signup,
  updatePassword,
} from "../controllers/authController.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

router.post("/forgotpassword", forgotPassword);
router.patch("/resetpassword/:token", resetPassword);
router.get("/confirmmail/:token", confirmMail);

router.use(protect);

router.post("/logout", logout);
router.patch("/updatepassword", updatePassword);
router.get("/getme", getMe);
router.patch("/updateme", updateMe);
router.delete("/deleteme", deleteMe);
router.post("/sendnewconfrimmail", sendNewConfirmMail);
router.get("/getmychildren", getMyChildren);
router.get("/getmychildren/:id", getMyOneChild);
router.post("/childlogininfo/:id", createMyChildLoginInfo);
router.post("/sendchildauthmail/:id", sendChildAuthData);
router.post("/setchildauth/:token", setChildAuthData);
router.post("/createchild", createChild);

router.use(restrictTo(["admin", "employee"]));

router.get("/", getAllUsers);
router.route("/:id").get(getUser);

router.use(restrictTo(["admin"]));
router.post("/updaterole/:id", updateUsersRole);

export default router;
