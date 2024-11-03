const User = require('../models/User');
const checkValidForm = require('../modules/checkValidForm');
require('dotenv').config();


// Register Controller
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  console.log({name, email, password});

  let check = [];

  if (!checkValidForm.isValidEmail(email)) {
    check.push({elem: "#email", msg: "Invalid email"});
  }

  const user = await User.findOne({email});

  if (user) {
    check.push({elem: "other", msg: "User is already registered. Please <a href='/login'>login</a> or use <a href='/forgot-password'>forgot password</a> page to reset your password" });
    res.status(400).send(check);
    return false;
  }

  if (!checkValidForm.isValidName(name)) {
    check.push({elem: "#name", msg: "Name contains only letters and spaces and is at least three characters long"});
  }


  if (!checkValidForm.isStrongPassword(password)) {
    check.push({elem: "#password", msg: "Password should be minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character"});
  }

  if (check.length > 0) {
    res.status(400).send(check);
    return false;
  }

  try {
    const user = new User({ email, password });
    await user.save();
    res.status(200).send("Registration successful");
  } catch (error) {
    res.status(401).send(error);
  }
};

// Login Controller
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
    res.status(200).send("login successful");
  } else {
    res.status(400).send("User not found/ Credentials are wrong!");
  }
};

// Logout Controller
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/login');
  });
};