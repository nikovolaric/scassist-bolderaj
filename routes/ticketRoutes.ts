import { Router } from "express";
import {
  createTicketsForCompany,
  getAllTickets,
  getMyUsedTickets,
  getMyValidTickets,
  getOneTicket,
  useCuponTicket,
  useTicket,
} from "../controllers/ticketController";
import { protect, restrictTo } from "../controllers/authController";

const router = Router();

router.use(protect);

router.get("/mytickets", getMyValidTickets);
router.get("/mytickets/used", getMyUsedTickets);

router.use(restrictTo(["admin", "employee"]));

router.route("/").get(getAllTickets);

router.route("/:id").get(getOneTicket);

router.post("/use/:id", useTicket);
router.post("/usecupon/:id", useCuponTicket);

router.use(restrictTo(["admin"]));

router.post("/createforcompany/:id", createTicketsForCompany);

export default router;
