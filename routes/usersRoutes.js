const express = require('express');
const router = express.Router();
const User = require('../models/User');
const moment = require('moment');
const nodemailer = require('nodemailer');
const { authenticate, authorize } = require("../modules/auth");
const { allProjects } = require("../modules/mw-data");

// Route to list all users
router.get('/users', authenticate, authorize("viewUsers"), allProjects, async (req, res) => {
  try {
    const users = await User.find().lean();

    res.render('users', { 
      layout: "dashboard", 
      data: {
        userName: req.session.user.name,
        userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
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
  const { name, email, role, status } = req.body;

  try {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = moment().add(24, 'hours').toDate();

    const newUser = new User({
      name,
      email,
      role,
      status,
      inviteToken,
      inviteExpires,
    });

    await newUser.save();

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
      to: email,
      subject: 'Invited to akeurope dashboard',
      html: compiledTemplate({
        name: name,
        inviteLink: `${process.env.URL}/users/register/${inviteToken}`
      }),
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
          return res.status(400).send(err);
      }
      res.status(200).send("Email sent successfully.");
    });

  } catch (err) {
    res.status(500).send('Error creating user', err);
  }
});

module.exports = router;