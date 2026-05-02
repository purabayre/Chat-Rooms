const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    reactions: {
      type: Map,
      of: [mongoose.Schema.Types.ObjectId],
      default: {},
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
