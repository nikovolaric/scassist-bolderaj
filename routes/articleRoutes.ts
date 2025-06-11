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
  registerPremise,
  updateArticle,
} from "../controllers/articleController";
import { protect, restrictTo } from "../controllers/authController";
import { checkPayment } from "../controllers/paymentController";

const router = Router();

router.use(protect);

router.get("/getvisibleusers", getAllVisibleArticlesUsers);
router.get("/getgifts/:agegroup", getAllGiftArticles);

router.post("/buyarticlesonline", checkPayment, buyArticlesOnline);
router.post("/buyarticlesonline/:id", checkPayment, buyArticlesOnlineForChild);
router.post("/buygiftonline", checkPayment, buyGiftOnline);

router.get("/:id", getOneArticle);
router.use(restrictTo(["admin", "employee"]));

router.post("/sellinperson/:id", buyArticlesInPerson);
router.get("/getvisiblereception", getAllVisibleArticlesReception);

router.use(restrictTo(["admin"]));
router.post("/premise", registerPremise);
router.route("/").get(getAllArticles).post(createArticle);
router.route("/:id").patch(updateArticle).delete(deleteArticle);

export default router;
