require('dotenv').config();
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const { validatePhoneNumber, sendTextMessage } = require('../modules/twilio');
const { sendEmail } = require('../modules/zohoMail');
const { sendErrorToTelegram, sendTelegramMessage } = require('../../akeurope-cp/modules/telegramBot');
const { getPaidOrdersByEntryId } = require('../modules/projectEntries');
const { logTemplates } = require('./logTemplates');
const { saveLog } = require('../modules/logAction');

async function getOrCreateInviteToken(customerId) {

    const customer = await Customer.findById(customerId);

    if (customer?.inviteToken && customer.inviteExpires > new Date()) {
        const expiresIn = Math.round((customer.inviteExpires - new Date()) / (1000 * 60)); 
        return { token: customer.inviteToken, expiresIn };
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    await Customer.findByIdAndUpdate(customerId, { inviteToken: newToken, inviteExpires: expires });

    return { token: newToken, expiresIn: 1440 }; 
}

function formatExpiresIn(minutes) {
    return minutes > 60 ? `${parseInt(minutes / 60)} hours` : `${minutes} minutes`;
}

const sendNotificationToDonor = async (notifyCustomer, entry, actor, project, changes) => {
    try {
        const orders = await getPaidOrdersByEntryId(null, null, entry._id);
        if (orders.length == 0) throw new Error('No order exists for this entry');
        if (orders.length > 1) throw new Error('There should only be one paid order');
        const customerId = orders[0].customerId;
        const customer = await Customer.findById(customerId).lean();
        if (!customer) throw new Error('Customer does not exist - something is wrong please check');

        await saveLog(
            logTemplates({
                type: 'donorEntryUpdated',
                entity: customer,
                entry,
                actor,
                project,
                changes,
            }),
        );

        if (!customer.tel) customer.tel = await Donor.findOne({ email: customer.email }).lean();
        if (!customer.emailStatusUpdates) notifyCustomer.sendEmail = false;
        if (!customer.phoneStatusUpdates) notifyCustomer.sendText = false;
        if (!notifyCustomer.sendText && !notifyCustomer.sendEmail)
            throw new Error('Customer has all fields as false, please check if it is ok');

        if (notifyCustomer.sendEmail) {
            let message = notifyCustomer.email?.message;
            const subject = notifyCustomer.email?.subject;
            const email = customer.email;
            const name = customer.name || customer.firstName;
            let link, linkLabel;
            if (customer.password) {
                link = `${process.env.CUSTOMER_PORTAL_URL}/dashboard`;
                linkLabel = 'View Beneficiary Details';
            } else {
                linkLabel = 'Register to view beneficiary profile';
                const {token, expiresIn} = await getOrCreateInviteToken(customer._id);
                link = `${process.env.CUSTOMER_PORTAL_URL}/register/${token}`;
                message = `${message} <br>Your invite link will expire in ${formatExpiresIn(expiresIn)}.`;
            }
            await sendEmail(email, name, subject, message, link, linkLabel);
            await sendTelegramMessage(`Email sent to ${customer.name} | ${customer.email} \n\n ${message}`);
        }

        if (notifyCustomer.sendText) {
            if (!customer.tel)
                throw new Error(
                    `Customer ${customer.name || customer.firstName} \n\n ${
                        customer.email
                    } \n\n does not have a phone number to send him this message: ${notifyCustomer.text}`,
                );
            const phone = await validatePhoneNumber(customer.tel);
            await sendTextMessage(phone, notifyCustomer.text);
            await sendTelegramMessage(`Text message sent to ${customer.name} | ${phone} \n\n ${notifyCustomer.text}`);
        }

        return true;
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message || error);
    }
};

module.exports = {
    sendNotificationToDonor,
};
