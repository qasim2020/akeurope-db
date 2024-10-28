const authenticate = (req, res, next) => {
  console.log(req.session.user);
  if (req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(400).render("error", {heading: "Unauthorized", error: "User is not logged in."});
};

const authorize = (req, res, next) => {
  if (req.user.role === 'admin') {
    return next();
  }
  return res.status(403).render("error", { heading: "Forbidden", error: 'Admin access required.' });
};

module.exports = { authenticate, authorize };