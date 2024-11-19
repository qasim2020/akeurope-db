const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const router = express.Router();
const User = require('../models/User');
const moment = require('moment');
const nodemailer = require('nodemailer');
const { authenticate, authorize } = require("../modules/auth");
const { allProjects } = require("../modules/mw-data");
const checkValidForm = require("../modules/checkValidForm");
const { forgotPassword } = require('../controllers/forgotPassword');
const { sendEmail } = require('../modules/sendEmail');

// Route to list all users
router.get('/users', authenticate, authorize("viewUsers"), allProjects, async (req, res) => {
  try {
    const users = await User.find().lean();

    res.render('users', { 
      layout: "dashboard", 
      data: {
        userName: req.session.user.name,
        userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
        userEmail: req.session.user.email, 
        projects: req.allProjects,
        layout: req.session.layout,
        activeMenu: "users",
        role: req.userPermissions,
        users: users,
      }
    });
  } catch (err) {
    res.status(500).send('Error fetching users');
  }
});

router.get('/getUsersData', authenticate, authorize("viewUsers"), async (req,res) => {
  try {
    const users = await User.find().lean();
    
    res.render('partials/showUsers', { 
        layout: false, 
        data: {
          layout: req.session.layout,
          role: req.userPermissions,
          userEmail: req.session.user.email, 
          users,
        }
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching entries partial', details: error.message });
  }

});

router.get('/getUserModal/:userId', authenticate, authorize("editUsers"), async (req,res) => {
  try {
    let user = await User.findOne({_id: req.params.userId}).lean();
    if (!user) {
      return res.status(400).send("User not found");
    }
    res.render('partials/editUserModal', { layout: false, data: {user} });
  } catch(e) {
    res.status(400).send(e);
  }
});

router.post('/users/create', authenticate, authorize("createUsers"), async (req, res) => {
  const { name, email, role} = req.body;

  let check = [];

  if (!checkValidForm.isValidEmail(email)) {
    check.push({elem: ".email", msg: "Invalid email"});
  }

  if (!checkValidForm.isValidName(name)) {
    check.push({elem: ".name", msg: "Name contains only letters and spaces and is at least three characters long"});
  }

  if (check.length > 0) {
    res.status(400).send(check);
    return false;
  }

  try {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = moment().add(24, 'hours').toDate();

    const newUser = new User({
      name,
      email,
      role,
      status: "Invite Sent",
      inviteToken,
      inviteExpires,
    });

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
    const templatePath = path.join(__dirname, '../views/emails/userInvite.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    sendEmail({
      to: email,
      subject: 'Invited to akeurope dashboard',
      htmlContent: compiledTemplate({
        name: name,
        inviteLink: `${process.env.URL}/users/register/${inviteToken}`
      }),
    }).then( async (response) => {
      console.log(response);
      await newUser.save();
      res.status(200).send("Email sent successfully");
    }).catch( err => {
      console.log(err);
      res.status(500).send('Email was not sent, therefore user was not created!');
    })

    // const mailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: email,
    //   subject: 'Invited to akeurope dashboard',
    //   html: compiledTemplate({
    //     name: name,
    //     inviteLink: `${process.env.URL}/users/register/${inviteToken}`
    //   }),
    // };

    // transporter.sendMail(mailOptions, async (err) => {
    //   if (err) {
    //       return res.status(400).send(err);
    //   }
    //   await newUser.save();
    //   res.status(200).send("Email sent successfully.");
    // });

  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

router.post('/users/update/:userId', authenticate, authorize("updateUsers"), async (req,res) => {
  const { name, role} = req.body;

  let check = [];

  if (!checkValidForm.isValidName(name)) {
    check.push({elem: ".name", msg: "Name contains only letters and spaces and is at least three characters long"});
  }

  let user = await User.find({_id: req.params.userId});

  if (req.session.user.email == user.email && req.session.user.role != role) {
    check.push({msg: "User is currently logged in, therefore role can not be changed!"});
  }

  if (check.length > 0) {
    res.status(400).send(check);
    return false;
  }

  try {
    await User.findOneAndUpdate({_id: req.params.userId}, {
      name, 
      role, 
      inviteToken: undefined, 
      inviteExpires: undefined, 
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined
    });
    res.status(200).send("User updated successfully");
  } catch (e) {
    console.log(e);
    res.status(400).send(e);
  }

})

router.post('/users/delete/:userId', authenticate, authorize("deleteUsers"), async (req,res) => {

  if (req.session.user._id == req.params.userId) {
    res.status(400).send("Forbidden: User can't delete himself/ herself!");
    return false;
  }

  try {
    await User.deleteOne({_id: req.params.userId});
    res.status(200).send("user deleted");
  } catch (e) {
    res.status(400).send(e);
  }
})

router.get('/users/register/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      inviteToken: req.params.token,
      inviteExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).render('error', { heading: "Link Expired!", error: 'Link is invalid or has expired. Please ask the admins to re-send you and invite email!' });
    }

    res.render('register', { name: user.name, email: user.email, token: user.inviteToken });
  } catch (err) {
    res.status(500).send('Error during registration');
  }
});

router.post('/users/register/:token', async (req, res) => {
  try {
    const { name, password } = req.body;
    const user = await User.findOne({
      inviteToken: req.params.token,
      inviteExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).send('Invalid or expired token');
    }

    user.name = name;
    user.password = password;
    user.status = 'Invite Accepted';
    user.inviteToken = undefined;
    user.inviteExpires = undefined;

    await user.save();
    res.status(200).send("User updated successfully");
  } catch (err) {
    res.status(500).send('Error completing registration');
  }
});

router.post('/users/sendInvite', authenticate, authorize("editUsers"), async (req,res) => {
  try {

    const { userId } = req.body;

    if (userId == req.session.user._id) {
      return res.status(400).send("You can not invite yourself!");
    }

    const user = await User.findOne({_id: userId});

    if (!user) {
      return res.status(400).send('User not found');
    }
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = moment().add(24, 'hours').toDate();

    user.status = 'Invite Sent';
    user.inviteToken = inviteToken;
    user.inviteExpires = inviteExpires;

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
    const templatePath = path.join(__dirname, '../views/emails/userInvite.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Invited to akeurope dashboard',
      html: compiledTemplate({
        name: user.name,
        inviteLink: `${process.env.URL}/users/register/${inviteToken}`
      }),
    };

    transporter.sendMail(mailOptions, async (err) => {
      if (err) {
          return res.status(400).send(err);
      }
      await user.save();
      res.status(200).send("Email sent successfully.");
    });

  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
})

module.exports = router;