const { roles, hasPermission } = require('../modules/roles');

const authenticate = (req, res, next) => {
  if (req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(404).render("error", {heading: "Unauthorized", error: "User is not logged in."});
};

const authorize = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;  // Assuming user's role is stored in req.user

    if (!userRole || !hasPermission(userRole, permission)) {
      return res.status(401).send(`Unauthorized: ${userRole} can't ${permission}`);
    }

    req.userPermissions = roles[userRole] || [];
    next(); 
  };
};

module.exports = { authenticate, authorize };