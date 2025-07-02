import { Router } from "express";
import {
  buyArticlesInPerson,
  buyArticlesOnline,
  buyArticlesOnlineForChild,
  buyGiftOnline,
  createArticle,
  deleteArticle,
  getAllArticles,
  getAllGiftArticles,
  getAllVisibleArticlesUsers,
  getAllVisibleArticlesReception,
  getOneArticle,
  updateArticle,
} from "../controllers/articleController";
import { protect, restrictTo } from "../controllers/authController";
import { checkPayment } from "../controllers/paymentController";
import { protectCR } from "../controllers/cashRegisterRecordController";

const router = Router();

router.use(protect);

router.get("/getvisibleusers", getAllVisibleArticlesUsers);
router.get("/getgifts/:agegroup", getAllGiftArticles);

router.post("/buyarticlesonline", checkPayment, buyArticlesOnline);
router.post("/buyarticlesonline/:id", checkPayment, buyArticlesOnlineForChild);
router.post("/buygiftonline", checkPayment, buyGiftOnline);
router.get(
  "/getvisiblereception",
  restrictTo(["admin", "employee"]),
  getAllVisibleArticlesReception
);

router.get("/:id", getOneArticle);
router.use(restrictTo(["admin", "employee"]));

router.post("/sellinperson/:id", protectCR, buyArticlesInPerson);

router.use(restrictTo(["admin"]));
router.route("/").get(getAllArticles).post(createArticle);
router.route("/:id").patch(updateArticle).delete(deleteArticle);

export default router;
