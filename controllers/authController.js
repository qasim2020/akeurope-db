const User = require('../models/User');
const checkValidForm = require('../modules/checkValidForm');
const { saveLog } = require('../controllers/logAction');
require('dotenv').config();

exports.login = async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const user = await User.findOne({ email });
  if (user && (await user.comparePassword(password))) {
    req.session.user = user;
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24; // 1 day (or less)
    }

    await saveLog({
      action: 'Logged in',
      details: `<strong>${req.session.user.email}</strong> logged in.`,
      color: 'grey',
      isNotification: true
    });

    res.status(200).send("login successful");
  } else {
    res.status(400).send("User not found/ Credentials are wrong!");
  }
};

exports.logout = async (req, res) => {
  if (req.session.user) {
    await saveLog({
      action: 'Logged out',
      details: `<strong>${req.session.user.email}</strong> logged out.`,
      color: 'grey',
      isNotification: true
    });
    req.session.destroy( (err) => {
      if (err) console.error(err);
      res.redirect('/login');
    });
  } else {
      res.redirect('/login');
  }
};