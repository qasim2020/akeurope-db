const nodemailer = require('nodemailer');
const crypto = require('crypto');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User'); 
const { isValidEmail } = require("../modules/checkValidForm");
const { saveLog } = require("../modules/logAction");
const { logTemplates } = require("../modules/logTemplates");

exports.resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send("Password reset token is invalid or has expired.");
    }

    user.password = password;
    user.resetPasswordToken = undefined; // Clear reset token
    user.resetPasswordExpires = undefined; // Clear token expiration

    await saveLog(logTemplates({ 
      type: 'passwordChanged',
      entity: user,
      actor: user
    }));

    await user.save();

    res.status(200).send("Password changed.");
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).send(error);
  }
};


exports.resetPasswordForm = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure token is not expired
    });

    if (!user) {
      return res.status(400).render('error', { heading: "Expired link", error: 'Password reset token is invalid or has expired.' });
    }

    // If valid, render the reset password form
    res.render('reset-password', { email: user.email, token: req.params.token });
  } catch (error) {
    console.error('Error in resetPasswordForm:', error);
    res.status(500).send('Server error');
  }
};


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    res.status(400).send("Invalid email");
    return false;
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(400).send("User not found");
    return false;
  };

  const token = crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; 

  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
  });

  const templatePath = path.join(__dirname, '../views/emails/passwordReset.handlebars');
  const templateSource = await fs.readFile(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(templateSource);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Password Reset',
    html: compiledTemplate({
      name: user.name, 
      resetLink: `${process.env.URL}/reset/${token}`
    }),
  };

  transporter.sendMail(mailOptions, async (err) => {
    if (err) {
        return res.status(400).send(err);
    }
    await user.save();
   
                           
    await saveLog(logTemplates({ 
      type: 'sentEmailForgotPassword',
      entity: user,
      actor: user
    }));

    res.status(200).send("Email sent successfully. Check your inbox.");
  });
};
