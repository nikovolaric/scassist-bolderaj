import { Query, Schema, model } from "mongoose";

interface IVisit {
  date: Date;
  user: Schema.Types.ObjectId;
  ticket: Schema.Types.ObjectId;
  company: Schema.Types.ObjectId;
}

const visitSchema = new Schema<IVisit>(
  {
    date: {
      type: Date,
      default: () => new Date(),
      required: [true, "Visit must have a date"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    ticket: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
  },
  { timestamps: true }
);

visitSchema.pre(/^find/, function (next) {
  if (this instanceof Query) {
    this.populate({
      path: "ticket user",
      select: "name firstName lastName birthDate",
    });
  }

  next();
});

const Visit = model<IVisit>("Visit", visitSchema);

export default Visit;
