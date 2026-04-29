const mongoose = require("mongoose");

const connectDB = () => {
  mongoose
    .connect("mongodb://127.0.0.1:27017/chat-app")
    .then(() => {
      console.log("MongoDB Connected");
    })
    .catch((err) => {
      console.log("DB Error:", err);
    });
};

module.exports = connectDB;
