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
  getAllVisibleArticles,
  getOneArticle,
  registerPremise,
  updateArticle,
} from "../controllers/articleController.js";
import { protect, restrictTo } from "../controllers/authController.js";
import { pay } from "../controllers/paymentController.js";

const router = Router();

router.use(protect);

router.get("/getvisible", getAllVisibleArticles);
router.get("/getgifts/:agegroup", getAllGiftArticles);
router.post("/premise", registerPremise);

router.post("/buyarticlesonline", buyArticlesOnline);
router.post("/buyarticlesonline/:id", buyArticlesOnlineForChild);
router.post("/buygiftonline", buyGiftOnline);

router.get("/:id", getOneArticle);
router.use(restrictTo(["admin", "employee"]));

router.post("/sellinperson/:id", buyArticlesInPerson);

router.use(restrictTo(["admin"]));
router.route("/").get(getAllArticles).post(createArticle);
router.route("/:id").patch(updateArticle).delete(deleteArticle);

export default router;
