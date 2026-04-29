const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");

router.get("/register", authController.getRegister);
router.post("/register", upload.single("avatar"), authController.postRegister);

router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);

router.post("/logout", requireAuth, authController.postLogout);

router.get("/profile", requireAuth, authController.getProfile);
router.post(
  "/profile",
  requireAuth,
  upload.single("avatar"),
  authController.patchProfile,
);

module.exports = router;
