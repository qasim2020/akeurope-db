const mongoose = require('mongoose');

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Customer = require('../models/Customer');
const Project = require('../models/Project');
const checkValidForm = require('../modules/checkValidForm');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const { visibleProjectDateFields } = require('../modules/projectEntries');
const { getSubscriptionsByOrderId, getPaymentByOrderId } = require('../modules/orders');
const { getEntriesByCustomerId } = require('../modules/ordersFetchEntries');
const { createPagination } = require('../modules/generatePagination');
const { getVippsPaymentByOrderId, getVippsSubscriptionsByOrderId } = require('../modules/vippsMain');

const Order = require('../models/Order');
const Donor = require('../models/Donor');
const Subscription = require('../models/Subscription');

const sessionCollection = mongoose.connection.collection('sessions_customer_portal');

async function killUserSessions(userId) {
    try {
        const sessions = await sessionCollection.find().toArray();
        for (const session of sessions) {
            const sessionData = JSON.parse(session.session);
            if (sessionData.user && sessionData.user._id === userId.toString()) {
                await sessionCollection.deleteOne({ _id: session._id });
                console.log(`Deleted session: ${session._id} for customer: ${userId}`);
            }
        }
        console.log('Session cleanup completed.');
    } catch (error) {
        console.error('Error deleting sessions:', error);
    }
}

exports.customers = async (req, res) => {
    const customers = await Customer.find().sort({_id: -1}).lean();

    const pagination = createPagination({
        req,
        totalEntries: customers.length,
        pageType: 'customers',
    });

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const customersPaginated = customers.slice(skip, skip + limit);

    res.render('customers', {
        layout: 'dashboard',
        data: {
            layout: req.session.layout,
            userId: req.session.user._id,
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: 'customers',
            projects: req.allProjects,
            role: req.userPermissions,
            customerId: new mongoose.Types.ObjectId(),
            customers: customersPaginated,
            pagination,
            logs: await visibleLogs(req, res),
            sidebarCollapsed: req.session.sidebarCollapsed,
        },
    });
};

exports.getCustomersData = async (req, res) => {
    try {
        const customers = await Customer.find().sort({_id: -1}).lean();

        const pagination = createPagination({
            req,
            totalEntries: customers.length,
            pageType: 'customers',
        });

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const customersPaginated = customers.slice(skip, skip + limit);

        res.render('partials/showCustomers', {
            layout: false,
            data: {
                customers: customersPaginated,
                layout: req.session.layout,
                pagination,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while fetching customer partial',
            details: error.message,
        });
    }
};

exports.getCustomerData = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.customerId,
        }).lean();

        res.render('partials/showCustomer', {
            layout: false,
            data: {
                customer,
                layout: req.session.layout,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while fetching customer partial',
            details: error.message,
        });
    }
};

exports.editModal = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.customerId,
        }).lean();

        res.render('partials/editCustomerModal', {
            layout: false,
            data: {
                layout: req.session.layout,
                projects: req.allProjects,
                customer,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const { name, email, tel, organization, address, status, role, customerId } = req.body;

        let check = [];

        if (!checkValidForm.isValidEmail(email)) {
            check.push({ elem: '.email', msg: 'Invalid email' });
        }

        if (!checkValidForm.isValidName(name)) {
            check.push({
                elem: '.name',
                msg: 'Name contains only letters and spaces and is at least three characters long',
            });
        }

        const checkCustomerExists = await Customer.findOne({ email }).lean();

        if (checkCustomerExists) {
            check.push({
                elem: 'other',
                msg: `Customer with ${email} already exists.`,
            });
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
            email: email.toLowerCase(),
            organization,
            address,
            tel,
            status,
            role,
            emailStatus: 'Email invite sent!',
            inviteToken,
            inviteExpires,
        });

        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const templatePath = path.join(__dirname, '../views/emails/customerInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Invited to akeurope customer portal',
            html: compiledTemplate({
                name: name,
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`,
            }),
        };

        transporter.sendMail(mailOptions, async (err) => {
            if (err) {
                return res.status(400).send(err);
            }

            await customer.save();

            await saveLog(
                logTemplates({
                    type: 'customerCreated',
                    entity: customer,
                    actor: req.session.user,
                }),
            );

            res.status(201).json({
                message: 'Customer created successfully',
                customer,
            });
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
};

exports.sendInvite = async (req, res) => {
    try {
        const { customerId } = req.body;

        const customer = await Customer.findOne({ _id: customerId });

        if (!customer) {
            return res.status(400).send('Customer not found');
        }
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();

        customer.emailStatus = 'Email invite sent!';
        customer.inviteToken = inviteToken;
        customer.inviteExpires = inviteExpires;

        let transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const templatePath = path.join(__dirname, '../views/emails/customerInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customer.email,
            subject: 'Invited to akeurope dashboard',
            html: compiledTemplate({
                name: customer.name,
                inviteLink: `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`,
            }),
        };

        transporter.sendMail(mailOptions, async (err) => {
            if (err) {
                return res.status(400).send(err);
            }
            await customer.save();

            await saveLog(
                logTemplates({
                    type: 'sentEmailCustomerInvite',
                    entity: customer,
                    actor: req.session.user,
                }),
            );

            res.status(200).send('Email sent successfully!');
        });
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const { name, organization, address, role, status, tel } = req.body;

        let check = [];

        if (!checkValidForm.isValidName(name)) {
            check.push({
                elem: '.name',
                msg: 'Name contains only letters and spaces and is at least three characters long',
            });
        }

        const customer = await Customer.findById(req.params.customerId);

        if (!customer) {
            check.push({ msg: 'Customer not found.' });
        }

        if (check.length > 0) {
            res.status(400).send(check);
            return false;
        }

        const updatedFields = {
            name,
            organization,
            address,
            status,
            tel,
            role,
        };

        const changes = getChanges(customer, updatedFields);

        if (changes.length > 0) {
            await saveLog(
                logTemplates({
                    type: 'customerUpdated',
                    entity: customer,
                    actor: req.session.user,
                    changes: getChanges(customer, updatedFields),
                }),
            );

            await Customer.findByIdAndUpdate(req.params.customerId, updatedFields);

            await killUserSessions(customer._id);
        }

        res.status(200).send('Customer updated successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error creating customer', error });
    }
};

exports.getLogs = async (req, res) => {
    res.render('partials/showCustomerLogs', {
        layout: false,
        data: {
            customerLogs: await customerLogs(req, res),
            customer: await Customer.findById(req.params.customerId).lean(),
        },
    });
};

exports.activeSubscriptions = async (req,res) => {
    try {
        const activeSubscriptions = await getEntriesByCustomerId(req, req.params.customerId);
        const customer = await Customer.findById(req.params.customerId).lean();
        res.render('partials/showCustomerSubscriptions',{
            layout: false,
            data: {
                activeSubscriptions,
                customer,
            }
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Could not fetch subscriptions', error });
    }
}


exports.customer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.customerId).lean();

        const donor = await Donor.findOne({ email: customer.email }).lean();
        customer.tel = customer.tel || donor?.tel;

        const projects = await Project.find({ status: 'active' }).lean();
        
        let visibleDateFields = [];

        if (!projects) {
            projects = [];
        } else {
            visibleDateFields = await visibleProjectDateFields(projects[0]);
        }

        const orders = await Order.find({customerId: customer._id}).sort({_id: -1}).lean();

        for (const order of orders) {
            order.stripeInfo = await getPaymentByOrderId(order._id) || await getSubscriptionsByOrderId(order._id);
            order.vippsInfo = (await getVippsPaymentByOrderId(order.vippsReference)) || 
                (await getVippsSubscriptionsByOrderId(order.vippsAgreementId));
        };

        const activeSubscriptions = await getEntriesByCustomerId(req, customer._id);

        const subscriptions = await Subscription.find({customerId: customer._id}).sort({_id: -1}).lean();

        for (const subscription of subscriptions) {
            subscription.stripeInfo = await getPaymentByOrderId(subscription._id) || await getSubscriptionsByOrderId(subscription._id);
            subscription.vippsInfo = (await getVippsPaymentByOrderId(subscription.vippsReference)) || 
                (await getVippsSubscriptionsByOrderId(subscription.vippsAgreementId));
        };

        res.render('customer', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: 'customers',
                projects,
                visibleDateFields,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                customerLogs: await customerLogs(req, res),
                customer,
                sidebarCollapsed: req.session.sidebarCollapsed,
                customers: await Customer.find().lean(),
                orders,
                activeSubscriptions,
                subscriptions,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server error',
            error,
        });
    }
};
