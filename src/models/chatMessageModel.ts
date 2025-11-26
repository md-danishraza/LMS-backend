import dynamoose from "dynamoose";

const chatMessageSchema = new dynamoose.Schema(
  {
    sessionId: {
      type: String,
      hashKey: true,
      required: true,
    },
    timestamp: {
      type: Number, // Unix timestamp for easy sorting
      rangeKey: true,
      required: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  {
    saveUnknown: true,
  }
);

const ChatMessage = dynamoose.model("ChatMessage", chatMessageSchema);

export default ChatMessage;
