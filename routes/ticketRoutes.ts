import { Router } from "express";
import {
  createTicket,
  createTicketsForCompany,
  deleteCompanyTickets,
  deleteTicket,
  getAllTickets,
  getChildValidTickets,
  getMyValidTickets,
  getOneTicket,
  updateTicket,
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
router.post("/deletecompanytickets/:id", deleteCompanyTickets);
router.route("/:id").patch(updateTicket).delete(deleteTicket);

export default router;
