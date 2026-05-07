const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/auth/login");
  }
  return next();
};

module.exports = requireAuth;
