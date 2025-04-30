import { Schema, model } from "mongoose";

interface IVisit {
  date: Date;
  user: Schema.Types.ObjectId;
  ticket: Schema.Types.ObjectId;
}

const visitSchema = new Schema<IVisit>(
  {
    date: {
      type: Date,
      default: Date.now(),
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
  },
  { timestamps: true }
);

// visitSchema.post("save", async function (doc, next) {
//   await doc.populate({ path: "user", select: "firstName" });

//   const user = doc.user as any;

//   await sendVisit({ firstName: user.firstName });

//   next();
// });

const Visit = model<IVisit>("Visit", visitSchema);

export default Visit;
