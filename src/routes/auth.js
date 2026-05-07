const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");
const upload = require("../middleware/upload");
const { generalLimiter, heavyLimiter } = require("../middleware/rateLimiter");

router.get("/register", generalLimiter, authController.getRegister);
router.post(
  "/register",
  generalLimiter,
  upload.single("avatar"),
  authController.postRegister,
);

router.get("/login", generalLimiter, authController.getLogin);
router.post("/login", authController.postLogin);

router.post("/logout", requireAuth, authController.postLogout);

router.get("/profile", requireAuth, generalLimiter, authController.getProfile);
router.post(
  "/profile",
  requireAuth,
  generalLimiter,
  upload.single("avatar"),
  authController.patchProfile,
);

module.exports = router;
