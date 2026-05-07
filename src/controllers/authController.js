const bcrypt = require("bcryptjs");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");

function removeUploadedFile(file) {
  if (!file) return;

  const filePath = path.join(
    __dirname,
    "..",
    "public",
    "uploads",
    file.filename,
  );

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Failed to delete uploaded file:", err.message);
    }
  });
}

exports.getRegister = (req, res, next) => {
  if (req.session.userId) return res.redirect("/chat");
  res.render("auth/register", { error: null, title: "Register" });
};

exports.postRegister = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    const cleanName = name ? name.trim() : "";
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const cleanPassword = password ? password.trim() : "";

    if (!cleanName || !cleanEmail || !cleanPassword) {
      removeUploadedFile(req.file);

      return res.render("auth/register", {
        error: "All fields are required.",
        title: "Register",
      });
    }

    if (cleanName.length < 2 || cleanName.length > 30) {
      removeUploadedFile(req.file);

      return res.render("auth/register", {
        error: "Name must be between 2 and 30 characters.",
        title: "Register",
      });
    }

    const nameRegex = /^[a-zA-Z0-9_ ]+$/;

    if (!nameRegex.test(cleanName)) {
      removeUploadedFile(req.file);

      return res.render("auth/register", {
        error: "Name contains invalid characters.",
        title: "Register",
      });
    }

    if (cleanPassword.length < 8) {
      removeUploadedFile(req.file);

      return res.render("auth/register", {
        error: "Password must be at least 8 characters.",
        title: "Register",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      removeUploadedFile(req.file);

      return res.render("auth/register", {
        error: "Invalid email format.",
        title: "Register",
      });
    }

    const existing = await User.findOne({
      email: cleanEmail,
    });

    if (existing) {
      removeUploadedFile(req.file);

      return res.render("auth/register", {
        error: "Email already registered.",
        title: "Register",
      });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 12);

    const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      avatarPath,
    });

    req.session.userId = user._id.toString();
    req.session.userName = user.name;

    req.session.save(() => {
      res.redirect("/chat");
    });
  } catch (err) {
    console.error(err);

    removeUploadedFile(req.file);

    res.render("auth/register", {
      error: "Something went wrong. Please try again.",
      title: "Register",
    });
  }
};

exports.getLogin = (req, res, next) => {
  if (req.session.userId) return res.redirect("/chat");
  res.render("auth/login", { error: null, title: "Login" });
};

exports.postLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("auth/login", {
        error: "Email and password are required.",
        title: "Login",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(password))) {
      return res.render("auth/login", {
        error: "Invalid email or password.",
        title: "Login",
      });
    }

    req.session.userId = user._id.toString();
    req.session.userName = user.name;
    res.redirect("/chat");
  } catch (err) {
    console.error(err);
    res.render("auth/login", {
      error: "Something went wrong. Please try again.",
      title: "Login",
    });
  }
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render("chat/profile", {
      user,
      error: null,
      success: null,
      title: "Edit Profile",
    });
  } catch (err) {
    res.redirect("/chat");
  }
};

exports.patchProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const update = {};

    if (name && name.trim()) update.name = name.trim();
    if (req.file) update.avatarPath = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(req.session.userId, update, {
      new: true,
    });
    req.session.userName = user.name;

    res.render("chat/profile", {
      user,
      error: null,
      success: "Profile updated successfully!",
      title: "Edit Profile",
    });
  } catch (err) {
    const user = await User.findById(req.session.userId);
    res.render("chat/profile", {
      user,
      error: "Update failed.",
      success: null,
      title: "Edit Profile",
    });
  }
};
