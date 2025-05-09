import { Schema, model } from "mongoose";

interface ITicket {
  name: {
    sl: string;
    en: string;
  };
  soldOn: Date;
  validUntil: Date;
  type: string;
  duration: number;
  visits: number;
  visitsLeft: number;
  usedOn: Date | undefined;
  used: Boolean;
  user: Schema.Types.ObjectId;
  company: Schema.Types.ObjectId;
  giftCode: string | undefined;
  morning: Boolean;
}

const ticketSchema = new Schema<ITicket>(
  {
    name: {
      sl: { type: String },
      en: { type: String },
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
      enum: ["dnevna", "terminska", "paket"],
    },
    morning: Boolean,
    duration: Number,
    visits: Number,
    visitsLeft: Number,
    usedOn: {
      type: Date,
    },
    used: {
      type: Boolean,
      default: false,
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
      unique: true,
    },
  },
  { timestamps: true }
);

ticketSchema.pre("save", function (next) {
  if (this.isNew) {
    this.visitsLeft = this.visits;
  }

  next();
});

const Ticket = model("Ticket", ticketSchema);

export default Ticket;
