require('dotenv').config();
const emailConfig = require('../config/emailConfig.js');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const nodemailer = require('nodemailer');

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

module.exports = {
    sendEmail
}
