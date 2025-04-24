require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

function formatPhoneNumber(phone) {
    phone = phone.replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) {
        phone = `+${phone}`;
    }
    return phone;
}

async function validatePhoneNumber(tel) {
    const phoneNumber = formatPhoneNumber(tel);

    const response = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({ type: ['carrier'] });

    if (!response || !response.valid) {
        throw new Error(`Invalid phone number: ${phoneNumber}`);
    }

    return response.phoneNumber;
}

async function sendTextMessage(phone, message) {
    phone = formatPhoneNumber(phone);

    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
        throw new Error('Invalid phone number format');
    }

    const response = await client.messages.create({
        body: message,
        from: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to: phone,
    });

    if (response.errorCode) {
        throw new Error(`Failed to send message to ${phone}: ${response.errorMessage}`);
    } else {
        console.log('Text message sent to', phone);
    }
}

const verifyTwilioWebhook = (req, res, next) => {
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${process.env.TWILIO_BASE_URL}${req.originalUrl}`; 
    const params = req.body;
    
    const isValid = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        url,
        params
    );

    if (!isValid) {
        console.warn('⚠️ Twilio signature verification failed');
        return res.status(403).send('Invalid Twilio signature');
    }

    next();
};

module.exports = { validatePhoneNumber, formatPhoneNumber, sendTextMessage, verifyTwilioWebhook };