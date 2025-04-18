import { Query, Schema, Types, model } from "mongoose";

interface IClass {
  className: string;
  teacher: Schema.Types.ObjectId;
  hourlyRate: number;
  students: {
    student: Schema.Types.ObjectId | Types.ObjectId;
    attendance: Date[];
  }[];
  maxStudents: number;
  full: boolean;
  dates: Date[];
  totalClasses: number;
  weekDay: number;
  time: number[];
  ageGroup: string;
}

const classSchema = new Schema<IClass>(
  {
    className: {
      type: String,
      required: true,
    },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    hourlyRate: { type: Number, required: true },
    students: [
      {
        student: { type: Schema.Types.ObjectId, ref: "User" },
        attendance: [{ type: Date }],
      },
    ],
    maxStudents: { type: Number, required: true },
    full: { type: Boolean, default: false },
    dates: [{ type: Date }],
    totalClasses: Number,
    weekDay: { type: Number },
    time: [Number],
    ageGroup: String,
  },
  { timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

classSchema.pre("save", function (next) {
  if (!this.isNew) return next();

  this.totalClasses = this.dates.length;

  next();
});

classSchema.pre("find", function (next) {
  if (this instanceof Query) {
    this.populate({
      path: "teacher",
      select: "firstName lastName email phoneNumber",
    });
  }

  next();
});

classSchema.virtual("hours").get(function () {
  return this.time.map((t: number) => {
    const hours = Math.floor(t);
    const minutes = Math.round((t - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  });
});

const Class = model<IClass>("Class", classSchema);

export default Class;
