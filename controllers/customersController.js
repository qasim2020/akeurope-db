const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Customer = require("../models/Customer");
const Project = require("../models/Project");
const checkValidForm = require("../modules/checkValidForm");
const { saveLog, visibleLogs } = require("../modules/logAction");

exports.customers = async(req,res) => {
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
            customers,
            logs: await visibleLogs(req,res)
        }
    })
}


exports.getData = async(req,res) => {
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
}

exports.editModal = async(req,res) => {
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
    
}

exports.createCustomer = async(req,res) => {
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
               
            await saveLog({
                entityType: 'customer',
                entityId: customer._id,
                actorType: 'user',
                actorId: req.session.user._id,
                url: `/customer/${customer._id}`,
                action: 'New customer created',
                details: `New customer <strong>${customer.email}</strong> created by <strong>${req.session.user.email}</strong>. Email invite sent to customer.`,
                color: 'green',
                isNotification: true
            }); 

            res.status(201).json({ message: 'Customer created successfully', customer });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
}

exports.sendInvite= async(req,res) => {
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
             
          await saveLog({
              entityType: 'customer',
              entityId: customer._id,
              actorType: 'user',
              actorId: req.session.user._id,
              url: `/customer/${customer._id}`,
              action: 'Email invite sent',
              details: `Email invite sent to <strong>${customer.email}</strong>. Action by <strong>${req.session.user.email}</strong>`,
              color: 'green',
              isNotification: true
          }); 
    
          res.status(200).send("Email sent successfully!");
        });
    
    } catch (err) {
    console.log(err);
    res.status(500).send(err);
    }
}

exports.updateCustomer = async(req,res) => {
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

        const customer = await Customer.findById(req.params.customerId);

        if (!customer) {
            check.push({msg: "Customer not found."});
        }

        if (check.length > 0) {
            res.status(400).send(check);
            return false;
        }

        const changes = [];
        const updatedFields = { name, organization, location, status, projects };

        Object.entries(updatedFields).forEach(([field, newValue]) => {
            if (customer[field] !== newValue) {
                changes.push({
                    field,
                    from: customer[field],
                    to: newValue,
                });
            }
        });

        await Customer.findByIdAndUpdate(req.params.customerId, updatedFields);

        const changeDetails = changes
        .map(
          (change) =>
            `<strong>${change.field}</strong>: "${change.from}" → "${change.to}"`
        )
        .join('<br>');
                 
        await saveLog({
            entityType: 'customer',
            entityId: customer._id,
            actorType: 'user',
            actorId: req.session.user._id,
            url: `/customer/${customer._id}`,
            action: 'Customer updated',
            details: `Customer <strong>${customer.email}</strong> updated by <strong>${req.session.user.email}</strong>:<br>${changeDetails}`,
            color: 'blue',
            isNotification: true,
        });

        res.status(200).send("Customer updated successfully!");

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
}
