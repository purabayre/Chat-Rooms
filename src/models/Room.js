const mongoose = require("mongoose");
const crypto = require("crypto");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    inviteToken: {
      type: String,
      default: null,
    },

    invitedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

roomSchema.pre("save", function (next) {
  if (this.isPrivate && !this.inviteToken) {
    this.inviteToken = crypto.randomUUID();
  }
});

module.exports = mongoose.model("Room", roomSchema);
