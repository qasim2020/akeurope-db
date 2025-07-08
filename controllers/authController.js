const User = require('../models/User');
const checkValidForm = require('../modules/checkValidForm');
const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');

require('dotenv').config();

exports.login = async (req, res) => {
  
  let { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password are required!");
  }
  
  email = email.toLowerCase();

  const user = await User.findOne({ email });

  if (user && (await user.comparePassword(password))) {

    req.session.user = user;

    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    } else {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24; 
    }

    await saveLog(logTemplates({ 
      type: 'login',
      entity: req.session.user, 
      actor: req.session.user 
    }));

    res.status(200).send("login successful");

  } else {

    console.log(error);
    res.status(400).send("User not found/ Credentials are wrong!");

  }
};

exports.logout = async (req, res) => {
  if (req.session.user) {
    await saveLog(logTemplates({ 
      type: 'logout',
      entity: req.session.user, 
      actor: req.session.user 
    }));
    req.session.destroy( (err) => {
      if (err) console.error(err);
      res.redirect('/login');
    });
  } else {
      res.redirect('/login');
  }
};