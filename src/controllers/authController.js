const bcrypt = require("bcryptjs");
const User = require("../models/User");

exports.getRegister = (req, res) => {
  if (req.session.userId) return res.redirect("/chat");
  res.render("auth/register", { error: null, title: "Register" });
};

exports.postRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.render("auth/register", {
        error: "All fields are required.",
        title: "Register",
      });
    }
    if (password.length < 8) {
      return res.render("auth/register", {
        error: "Password must be at least 8 characters.",
        title: "Register",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.render("auth/register", {
        error: "Email already registered.",
        title: "Register",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;

    const user = await User.create({ name, email, passwordHash, avatarPath });

    req.session.userId = user._id.toString();
    req.session.userName = user.name;
    res.redirect("/chat");
  } catch (err) {
    console.error(err);
    res.render("auth/register", {
      error: "Something went wrong. Please try again.",
      title: "Register",
    });
  }
};

exports.getLogin = (req, res) => {
  if (req.session.userId) return res.redirect("/chat");
  res.render("auth/login", { error: null, title: "Login" });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("auth/login", {
        error: "Email and password are required.",
        title: "Login",
      });
    }

    const user = await User.findOne({ email });
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

exports.postLogout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
};

exports.getProfile = async (req, res) => {
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

exports.patchProfile = async (req, res) => {
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
