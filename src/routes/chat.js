const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const requireAuth = require("../middleware/requireAuth");
const { generalLimiter, heavyLimiter } = require("../middleware/rateLimiter");

router.get("/", requireAuth, generalLimiter, roomController.getRooms);
router.post("/rooms", requireAuth, generalLimiter, roomController.postRoom);
router.get("/users", requireAuth, generalLimiter, roomController.getAllUsers);
router.post(
  "/share-room",
  requireAuth,
  generalLimiter,
  roomController.shareRoom,
);
router.get(
  "/invite/:token",
  requireAuth,
  generalLimiter,
  roomController.joinByInvite,
);
router.get("/rooms/:id", requireAuth, generalLimiter, roomController.getRoom);

module.exports = router;
