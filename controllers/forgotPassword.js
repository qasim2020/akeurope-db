const nodemailer = require('nodemailer');
const crypto = require('crypto');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User'); 
const { isValidEmail } = require("../modules/checkValidForm");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    res.status(400).send("Invalid email");
    return false;
  }

  // Find the user by email
  const user = await User.findOne({ email });
  console.log(user);
  if (!user) {
    res.status(400).send("User not found");
    return false;
  };

  // Generate a reset token
  const token = crypto.randomBytes(20).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1-hour expiration
  await user.save();

  // Configure the SMTP transporter
  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
  });

  // Load and compile the Handlebars template
  const templatePath = path.join(__dirname, '../views/emails/passwordReset.handlebars');
  const templateSource = await fs.readFile(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(templateSource);

  // Define mail options, including the compiled HTML template with data
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Password Reset',
    html: compiledTemplate({
      name: user.name, 
      resetLink: `${process.env.URL}/reset/${token}`
    }),
  };

  console.log(mailOptions.html);

  // Send the email
  transporter.sendMail(mailOptions, (err) => {
    if (err) {
        return res.status(400).send(err);
    }
    res.status(200).send("Email sent successfully. Check your inbox.");
  });
};
