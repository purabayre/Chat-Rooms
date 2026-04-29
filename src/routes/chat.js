const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const requireAuth = require("../middleware/requireAuth");

router.use(requireAuth);

router.get("/", roomController.getRooms);
router.post("/rooms", roomController.postRoom);
router.get("/rooms/:id", roomController.getRoom);

module.exports = router;
