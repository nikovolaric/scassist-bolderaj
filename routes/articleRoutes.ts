import { Router } from "express";
import {
  buyArticlesInPerson,
  buyArticlesOnline,
  buyArticlesOnlineForChild,
  createArticle,
  deleteArticle,
  getAllArticles,
  getAllVisibleArticles,
  getOneArticle,
  registerPremise,
  updateArticle,
} from "../controllers/articleController";
import { protect, restrictTo } from "../controllers/authController";
import { makePayment } from "../controllers/paymentController";

const router = Router();

router.use(protect);

router.get("/getvisible", getAllVisibleArticles);
router.post("/premise", registerPremise);

router.post("/buyarticlesonline", makePayment, buyArticlesOnline);
router.post("/buyarticlesonline/:id", makePayment, buyArticlesOnlineForChild);

router.get("/:id", getOneArticle);
router.use(restrictTo(["admin", "employee"]));

router.post("/sellinperson/:id", buyArticlesInPerson);

router.use(restrictTo(["admin"]));
router.route("/").get(getAllArticles).post(createArticle);
router.route("/:id").patch(updateArticle).delete(deleteArticle);

export default router;
