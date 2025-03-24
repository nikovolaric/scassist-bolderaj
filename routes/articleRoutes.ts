import { Router } from "express";
import {
  buyArticlesInPerson,
  buyArticlesOnline,
  buyArticlesOnlineForChild,
  createArticle,
  deleteArticle,
  getAllArticles,
  getOneArticle,
  registerPremise,
  updateArticle,
} from "../controllers/articleController";
import { protect, restrictTo } from "../controllers/authController";

const router = Router();

router.use(protect);

router.get("/", getAllArticles);
router.get("/:id", getOneArticle);

router.post("/premise", registerPremise);

router.post("/buyarticlesonline", buyArticlesOnline);
router.post("/buyarticlesonline/:id", buyArticlesOnlineForChild);

router.use(restrictTo(["admin", "employee"]));

router.post("/sellinperson/:id", buyArticlesInPerson);

router.use(restrictTo(["admin"]));

router.post("/", createArticle);
router.route("/:id").patch(updateArticle).delete(deleteArticle);

export default router;
