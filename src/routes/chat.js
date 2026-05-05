const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const requireAuth = require("../middleware/requireAuth");

router.get("/", requireAuth, roomController.getRooms);
router.post("/rooms", requireAuth, roomController.postRoom);
router.get("/users", requireAuth, roomController.getAllUsers);
router.post("/share-room", requireAuth, roomController.shareRoom);
router.get("/invite/:token", requireAuth, roomController.joinByInvite);
router.get("/rooms/:id", requireAuth, roomController.getRoom);

module.exports = router;
