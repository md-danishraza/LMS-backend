import dynamoose from "dynamoose";

const mentorshipSessionSchema = new dynamoose.Schema(
  {
    sessionId: {
      type: String,
      hashKey: true,
      required: true,
    },
    studentId: {
      type: String,
      required: true,
      index: {
        name: "studentId-index",
        type: "global",
      },
    },
    teacherId: {
      type: String,
      required: true,
      index: {
        name: "teacherId-index",
        type: "global",
      },
    },
    courseId: {
      type: String,
      required: true,
    },
    date: {
      type: String, // ISO Date String
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  {
    timestamps: true,
  }
);

const MentorshipSession = dynamoose.model(
  "MentorshipSession",
  mentorshipSessionSchema
);

export default MentorshipSession;
