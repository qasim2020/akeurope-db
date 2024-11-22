const nodemailer = require('nodemailer');
const crypto = require('crypto');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User'); 
const { isValidEmail } = require("../modules/checkValidForm");
const { saveLog } = require("../controllers/logAction");

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
   
    await saveLog({
      entityType: 'user',
      entityId: user._id,
      actorType: 'user',
      actorId: user._id,
      action: 'Reset password',
      details: `Sent forgot password email to <strong>${user.email}</strong> .`,
      color: 'grey',
      isNotification: true
    }); 

    res.status(200).send("Email sent successfully. Check your inbox.");
  });
};
