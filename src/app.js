require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const initSocket = require("./socket");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const MongoDBStore = require("connect-mongodb-session")(session);

connectDB();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "Public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
  },
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId || null;
  res.locals.currentUserName = req.session.userName || null;
  next();
});

app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/chat");
  res.render("index", { title: "Welcome to ChatApp" });
});

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);

app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("500", { title: "Server Error" });
});

initSocket(io, sessionMiddleware);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
