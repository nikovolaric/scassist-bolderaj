import { Router } from "express";
import {
  createTicketsForCompany,
  getAllTickets,
  getChildValidTickets,
  getMyUsedTickets,
  getMyValidTickets,
  getOneTicket,
  useCuponTicket,
  useTicket,
} from "../controllers/ticketController.js";
import { protect, restrictTo } from "../controllers/authController.js";

const router = Router();

router.use(protect);

router.get("/mytickets", getMyValidTickets);
router.get("/mytickets/used", getMyUsedTickets);
router.get("/childTickets/:id", getChildValidTickets);

router.use(restrictTo(["admin", "employee"]));

router.route("/").get(getAllTickets);

router.route("/:id").get(getOneTicket);

router.post("/use/:id", useTicket);
router.post("/usecupon/:id", useCuponTicket);

router.use(restrictTo(["admin"]));

router.post("/createforcompany/:id", createTicketsForCompany);

export default router;
