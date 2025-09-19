require('dotenv').config();
const emailConfig = require('../config/emailConfig.js');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const nodemailer = require('nodemailer');
const File = require('../models/File');
const crypto = require('crypto');
const moment = require('moment');
const Customer = require('../models/Customer');

const getPortalUrl = async (customer) => {
    let portalUrl = '',
        newUser = false;
    if (!customer.password) {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();
        await Customer.findOneAndUpdate({ _id: customer._id }, { $set: { inviteToken, inviteExpires } }, { new: true });
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/register/${inviteToken}`;
        newUser = true;
    } else {
        portalUrl = `${process.env.CUSTOMER_PORTAL_URL}/login`;
        newUser = false;
    }
    return {
        portalUrl,
        newUser,
    };
};

const sendEmail = async (email, name, subject, message, link, linkLabel) => {
    let transporter = nodemailer.createTransport(emailConfig);

    const templatePath = path.join(__dirname, '../views/emails/notificationEmail.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: `"Alkhidmat Europe" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html: compiledTemplate({
            name,
            message,
            link,
            linkLabel
        }),
    };

    transporter.sendMail(mailOptions, async (err) => {
        if (err) {
            throw new Error('Error sending email', err);
        }
        console.log('Email sent!');
    });
}

const emailOrderUpdate = async (email, salute, subject, message, entityId, files) => {

    const customer = await Customer.findOne({ email }).lean();
    const { portalUrl, newUser } = await getPortalUrl(customer);

    const filesMadePublic = [];
    for (const fileId of files) {
        const file = await File.findOne({ 'links.entityId': entityId, _id: fileId });
        if (!file) {
            throw new Error(`File with ID ${fileId} not found`);
        }
        const secretToken = crypto.randomBytes(32).toString('hex');
        file.secretToken = file.secretToken ? file.secretToken : secretToken;
        file.public = true;
        await file.save();
        const objectFile = file.toObject();
        objectFile.url = `${process.env.CUSTOMER_PORTAL_URL}/file-open/${file.secretToken}`;
        filesMadePublic.push(objectFile);
    };

    let transporter = nodemailer.createTransport(emailConfig);

    const templatePath = path.join(__dirname, '../views/emails/emailOrderUpdate.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const toEmail = process.env.ENV === 'test' ? 'qasimali24@gmail.com' : email;

    const mailOptions = {
        from: `"Alkhidmat Europe" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject,
        html: compiledTemplate({
            salute,
            message,
            portalUrl,
            files: filesMadePublic,
        }),
    };

    await transporter.sendMail(mailOptions);
}

const emailEntryUpdate = async (email, salute, subject, message, entityId, files, entry) => {

    const customer = await Customer.findOne({ email }).lean();
    const { portalUrl, newUser } = await getPortalUrl(customer);

    const filesMadePublic = [];
    for (const fileId of files) {
        const file = await File.findOne({ 'links.entityId': entityId, _id: fileId });
        if (!file) {
            throw new Error(`File with ID ${fileId} not found`);
        }
        const secretToken = crypto.randomBytes(32).toString('hex');
        file.secretToken = file.secretToken ? file.secretToken : secretToken;
        file.public = true;
        await file.save();
        const objectFile = file.toObject();
        objectFile.url = `${process.env.CUSTOMER_PORTAL_URL}/file-open/${file.secretToken}`;
        filesMadePublic.push(objectFile);
    };

    let transporter = nodemailer.createTransport(emailConfig);

    const templatePath = path.join(__dirname, '../views/emails/emailEntryUpdate.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const toEmail = process.env.ENV === 'test' ? 'qasimali24@gmail.com' : email;

    const mailOptions = {
        from: `"Alkhidmat Europe" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject,
        html: compiledTemplate({
            salute,
            message,
            entry,
            portalUrl,
            files: filesMadePublic,
        }),
    };

    await transporter.sendMail(mailOptions);
    
}

const beneficiariesPaid = async (payment) => {
    let transporter = nodemailer.createTransport(emailConfig);

    const templatePath = path.join(__dirname, '../views/emails/beneficiariesPaid.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const toEmail = process.env.ENV === 'test' ? 'qasimali24@gmail.com' : payment.email;

    const mailOptions = {
        from: `"Alkhidmat Europe" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: '🎉 Beneficiaries Paid · Notification',
        html: compiledTemplate({
            name: payment.name,
            children: payment.children,
        }),
    };

    transporter.sendMail(mailOptions, async (err) => {
        if (err) {
            throw new Error('Error sending email', err);
        }
        console.log('Email sent!');
    });

    throw new Error('Stop here');
}

module.exports = {
    sendEmail,
    emailOrderUpdate,
    emailEntryUpdate,
    getPortalUrl,
    beneficiariesPaid
}
