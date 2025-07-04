import { Router } from "express";
import {
  createTicket,
  createTicketsForCompany,
  getAllTickets,
  getChildValidTickets,
  getMyValidTickets,
  getOneTicket,
  useTicket,
} from "../controllers/ticketController";
import { protect, restrictTo } from "../controllers/authController";

const router = Router();

router.use(protect);

router.get("/mytickets", getMyValidTickets);
router.get("/childTickets/:id", getChildValidTickets);

router.use(restrictTo(["admin", "employee"]));

router.route("/").get(getAllTickets);

router.route("/:id").get(getOneTicket);

router.post("/use/:id", useTicket);

router.use(restrictTo(["admin"]));

router.route("/").post(createTicket);
router.post("/createforcompany/:id", createTicketsForCompany);

export default router;
