const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

// email reqs
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const Customer = require("../models/Customer");
const Project = require("../models/Project");
const checkValidForm = require("../modules/checkValidForm");

router.get("/customers", authenticate, authorize("viewCustomers"), allProjects, async (req,res) => {
    const customers = await Customer.find().lean();

    for (const customer of customers) {
        customer.projects = await Promise.all(
            customer.projects.map(async (val) => {
                return await Project.findOne({ slug: val }).lean();
            })
        );
    }

    res.render("customers",{
        layout: "dashboard",
        data: {
            layout: req.session.layout,
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: "customers",
            projects: req.allProjects,
            role: req.userPermissions,
            customerId: new mongoose.Types.ObjectId(),
            customers
        }
    })
})


router.get('/getCustomersData', authenticate, authorize("viewCustomers"), async (req,res) => {
    try {
        const customers = await Customer.find().lean();

        for (const customer of customers) {
            customer.projects = await Promise.all(
                customer.projects.map(async (val) => {
                    return await Project.findOne({ slug: val }).lean();
                })
            );
        }

        res.render('partials/showCustomers', { 
            layout: false, 
            data: {
              customers, 
              layout: req.session.layout
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching customer partial', details: error.message });
    }
})

router.get('/getEditCustomerModal/:customerId', authenticate, authorize("editCustomers"), allProjects, async (req,res) => {
    try {
        const customer = await Customer.findOne({_id: req.params.customerId}).lean();

        res.render('partials/editCustomerModal', {
          layout: false,
          data: {
            layout: req.session.layout,
            projects: req.allProjects, 
            customer
          }
        })
    
    } catch (error) {
        res.status(500).json({ error: 'Error fetching entries', details: error.message });
    }
    
})

router.post("/customer/create", authenticate, authorize("createCustomers"), async (req,res) => {
    try {
        const { name, email, organization, location, status, projects, customerId} = req.body;

        let check = [];
        
        if (!checkValidForm.isValidEmail(email)) {
            check.push({elem: ".email", msg: "Invalid email"});
        }

        if (!checkValidForm.isValidName(name)) {
            check.push({elem: ".name", msg: "Name contains only letters and spaces and is at least three characters long"});
        }

        await Promise.all(
            projects.map(async (slug) => {
                let project = await Project.findOne({ slug });
                if (!project) {
                    check.push({ elem: ".projects", msg: `Project ${slug} was not foud!`});
                }
                if (project.status == "inactive") {
                    check.push({ elem: ".projects", msg: `Project ${slug} is not Active!`});
                }
            })
        );

        const checkCustomerExists = await Customer.findOne({email}).lean();

        if (checkCustomerExists) {
            check.push({ elem: "other", msg: `Customer with ${email} already exists.`})
        }

        if (check.length > 0) {
            res.status(400).send(check);
            return false;
        }

        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();

        const customer = new Customer({
            _id: customerId, 
            name,
            email,
            organization,
            location,
            status,
            projects,
            emailStatus: "Email invite sent!",
            inviteToken, 
            inviteExpires
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
        const templatePath = path.join(__dirname, '../views/emails/customerInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);
    
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Invited to akeurope customer portal',
            html: compiledTemplate({
                name: name,
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`
            }),
        };
    
        transporter.sendMail(mailOptions, async (err) => {
            if (err) {
                return res.status(400).send(err);
            }
            await customer.save();
            res.status(201).json({ message: 'Customer created successfully', customer });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
});

router.post('/customer/sendInvite', authenticate, authorize("editCustomers"), async (req,res) => {
  try {

    const { customerId } = req.body;

    const customer = await Customer.findOne({_id: customerId});

    if (!customer) {
      return res.status(400).send('Customer not found');
    }
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = moment().add(24, 'hours').toDate();

    customer.emailStatus = "Email invite sent!",
    customer.inviteToken = inviteToken;
    customer.inviteExpires = inviteExpires;

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
    const templatePath = path.join(__dirname, '../views/emails/customerInvite.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customer.email,
      subject: 'Invited to akeurope dashboard',
      html: compiledTemplate({
        name: customer.name,
        inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`
      }),
    };

    transporter.sendMail(mailOptions, async (err) => {
      if (err) {
          return res.status(400).send(err);
      }
      await customer.save();
      res.status(200).send("Email sent successfully!");
    });

  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
})

router.post("/customer/update/:customerId", authenticate, authorize("createCustomers"), async (req,res) => {
    try {
        const { name, organization, location, status, projects } = req.body;

        let check = [];
        
        if (!checkValidForm.isValidName(name)) {
            check.push({elem: ".name", msg: "Name contains only letters and spaces and is at least three characters long"});
        }

        await Promise.all(
            projects.map(async (slug) => {
                let project = await Project.findOne({ slug });
                if (!project) {
                    check.push({ elem: ".projects", msg: `Project ${slug} was not foud!`});
                }
                if (project.status == "inactive") {
                    check.push({ elem: ".projects", msg: `Project ${slug} is not Active!`});
                }
            })
        );

        if (check.length > 0) {
            res.status(400).send(check);
            return false;
        }

        await Customer.findOneAndUpdate({_id: req.params.customerId}, {
            name,
            organization,
            location,
            status,
            projects
        });

        res.status(200).send("Customer updated successfully!");

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
});


module.exports = router;