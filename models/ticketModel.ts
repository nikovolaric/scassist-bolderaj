import { Schema, model } from "mongoose";

interface ITicket {
  name: string;
  soldOn: Date;
  validUntil: Date;
  type: string;
  duration: number;
  visits: number;
  usedOn: Date | undefined;
  used: Boolean;
  canUseUntil: Date | undefined;
  user: Schema.Types.ObjectId;
  company: Schema.Types.ObjectId;
  giftCode: string | undefined;
}

const ticketSchema = new Schema<ITicket>(
  {
    name: {
      type: String,
    },
    soldOn: {
      type: Date,
      default: Date.now(),
      required: [true, "Ticket must have a sold on date"],
    },
    validUntil: {
      type: Date,
      default: Date.now() + 1000 * 60 * 60 * 24 * 365,
      required: [true, "Ticket must have a valid until date"],
    },
    type: {
      type: String,
      required: [true, "Ticket must have a type"],
      enum: ["dnevna", "terminska", "paket", "dopoldanska"],
    },
    duration: Number,
    visits: Number,
    usedOn: {
      type: Date,
    },
    used: {
      type: Boolean,
      default: false,
    },
    canUseUntil: {
      type: Date,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    giftCode: {
      type: String,
    },
  },
  { timestamps: true }
);

const Ticket = model("Ticket", ticketSchema);

export default Ticket;
