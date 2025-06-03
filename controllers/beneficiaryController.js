const emailConfig = require('../config/emailConfig.js');
const mongoose = require('mongoose');

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const moment = require('moment');
const nodemailer = require('nodemailer');

const Beneficiary = require('../models/Beneficiary');
const Project = require('../models/Project');
const checkValidForm = require('../modules/checkValidForm');
const { saveLog, customerLogs, beneficiaryLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const { visibleProjectDateFields } = require('../modules/projectEntries');
const { getSubscriptionsByOrderId, getPaymentByOrderId } = require('../modules/orders');
const { getEntriesByCustomerId } = require('../modules/ordersFetchEntries');
const { createPagination } = require('../modules/generatePagination');
const { getVippsPaymentByOrderId, getVippsSubscriptionsByOrderId } = require('../modules/vippsMain');
const { getEntriesByBenficiaryId } = require('../modules/beneficiaryModules');

const Order = require('../models/Order');
const Donor = require('../models/Donor');
const Subscription = require('../models/Subscription');
const { sendTelegramMessageInGazaGroup } = require('../../akeurope-cp/modules/telegramBot.js');
const { generateSearchQueryFromSchema } = require('../modules/generateSearchQuery.js');

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

exports.beneficiaries = async (req, res) => {
    const { searchQuery } = generateSearchQueryFromSchema(req, Beneficiary.schema);
    const beneficiaries = await Beneficiary.find({
        $and: [
            { projects: { $in: req.allProjects.map(project => project.slug.toString()) } },
            searchQuery
        ]
    })
        .sort({ createdAt: -1 })
        .lean();

    const pagination = createPagination({
        req,
        totalEntries: beneficiaries.length,
        pageType: 'beneficiaries',
    });

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const beneficiariesPaginated = beneficiaries.slice(skip, skip + limit);

    res.render('beneficiaries', {
        layout: 'dashboard',
        data: {
            layout: req.session.layout,
            userId: req.session.user._id,
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: 'beneficiaries',
            projects: req.allProjects,
            role: req.userPermissions,
            beneficiaries: beneficiariesPaginated,
            pagination,
            logs: await visibleLogs(req, res),
            sidebarCollapsed: req.session.sidebarCollapsed,
        },
    });
};

exports.getBeneficiariesData = async (req, res) => {
    try {

        const { searchQuery } = generateSearchQueryFromSchema(req, Beneficiary.schema);
        const beneficiaries = await Beneficiary.find({
            $and: [
                { projects: { $in: req.allProjects.map(project => project.slug.toString()) } },
                searchQuery
            ]
        })
            .sort({ createdAt: -1 })
            .lean();

        const pagination = createPagination({
            req,
            totalEntries: beneficiaries.length,
            pageType: 'beneficiaries',
        });

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const beneficiariesPaginated = beneficiaries.slice(skip, skip + limit);

        res.render('partials/showBeneficiaries', {
            layout: false,
            data: {
                beneficiaries: beneficiariesPaginated,
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

exports.getBeneficiaryData = async (req, res) => {
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
        const { beneficiaryId } = req.params;
        const beneficiary = await Beneficiary.findOne({
            _id: beneficiaryId,
            projects: { $in: req.allProjects.map(project => project.slug.toString()) },
        }).sort({ createdAt: -1 }).lean();

        res.render('partials/editBeneficiaryModal', {
            layout: false,
            data: {
                layout: req.session.layout,
                projects: req.allProjects,
                beneficiary,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    }
};

exports.updateBeneficiary = async (req, res) => {
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

exports.linkedProfiles = async (req, res) => {
    try {
        const activeSubscriptions = await getEntriesByCustomerId(req, req.params.customerId);
        const customer = await Customer.findById(req.params.customerId).lean();
        res.render('partials/showCustomerSubscriptions', {
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

exports.beneficiary = async (req, res) => {
    try {
        const { beneficiaryId, slug } = req.params;
        const beneficiary = await Beneficiary.findOne({
            _id: beneficiaryId,
            projects: { $in: req.allProjects.map(project => project.slug.toString()) },
        }).sort({ createdAt: -1 }).lean();
        const profiles = await getEntriesByBenficiaryId(beneficiaryId);
        res.render('beneficiary', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: 'beneficiaries',
                projects: req.allProjects,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                beneficiaryLogs: await beneficiaryLogs(req, res),
                beneficiary,
                sidebarCollapsed: req.session.sidebarCollapsed,
                profiles,
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

exports.generateInviteLink = async (req, res) => {
    try {
        const { beneficiaryId } = req.params;
        const beneficiary = await Beneficiary.findOne({
            _id: beneficiaryId,
            projects: { $in: req.allProjects.map(project => project.slug.toString()) },
        });
        if (!beneficiary) throw new Error(`Beneficiary ${beneficiaryId} not found`);
        if (!beneficiary.phoneNumber) throw new Error(`Beneficiary ${beneficiary.name} does not have a phone number`);
        const token = crypto.randomBytes(20).toString('hex');
        beneficiary.resetPasswordToken = token;
        beneficiary.resetPasswordExpires = Date.now() + (24 * 3600000);
        beneficiary.resetPasswordLink = `${process.env.BENEFICIARY_PORTAL_URL}/resetlink/${beneficiary._id}/${token}`;
        await beneficiary.save();
        res.status(200).json({
            resetPasswordLink: beneficiary.resetPasswordLink,
            resetPasswordExpires: beneficiary.resetPasswordExpires
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send(error.message || 'An error occurred while generating the invite link');
    }
};
