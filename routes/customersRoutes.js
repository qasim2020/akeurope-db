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
    res.render("customers",{
        layout: "dashboard",
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: "customers",
            projects: req.allProjects,
            role: req.userPermissions,
            customerId: new mongoose.Types.ObjectId()
        }
    })
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
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/customers/register/${inviteToken}`
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

module.exports = router;