import { Query, Schema, Types, model } from "mongoose";

interface IClass {
  className: {
    sl: string;
    en: string;
  };
  teacher: Schema.Types.ObjectId[];
  hourlyRate: number;
  students: {
    student: Schema.Types.ObjectId | Types.ObjectId;
    attendance: Date[];
  }[];
  maxStudents: number;
  full: boolean;
  dates: Date[];
  totalClasses: number;
  time: number[];
  ageGroup: string[];
  article: Schema.Types.ObjectId[];
  replacements: {
    user: Schema.Types.ObjectId | Types.ObjectId;
    teacher: Schema.Types.ObjectId | Types.ObjectId;
    date: Date;
    id: string;
  }[];
  hiddenReception: boolean;
  hiddenUsers: boolean;
}

const classSchema = new Schema<IClass>(
  {
    className: {
      sl: {
        type: String,
      },
      en: {
        type: String,
      },
    },
    teacher: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    hourlyRate: { type: Number },
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
    time: [Number],
    ageGroup: [String],
    article: [
      {
        type: Schema.Types.ObjectId,
        ref: "Article",
      },
    ],
    replacements: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
        date: Date,
      },
    ],
    hiddenReception: {
      type: Boolean,
      default: true,
    },
    hiddenUsers: {
      type: Boolean,
      default: true,
    },
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
