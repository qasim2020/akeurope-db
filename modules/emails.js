require('dotenv').config();
const emailConfig = require('../config/emailConfig.js');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const nodemailer = require('nodemailer');
const File = require('../models/File');
const crypto = require('crypto');

const sendEmail = async (email, name, subject, message, link, linkLabel) => {
    let transporter = nodemailer.createTransport(emailConfig);
    
    const templatePath = path.join(__dirname, '../views/emails/notificationEmail.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
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

const sendEmailWithAttachments = async (email, salute, subject, message, entityId, files) => {
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
    
    const templatePath = path.join(__dirname, '../views/emails/notificationEmailWithAttachments.handlebars');
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
            files: filesMadePublic,
        }),
    };
    
    await transporter.sendMail(mailOptions);
}

module.exports = {
    sendEmail,
    sendEmailWithAttachments
}
