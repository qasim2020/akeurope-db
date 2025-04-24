const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const Chat = require('../models/Chat');

const handleWhatsappMessage = async (incoming) => {
    const isStatus = ['read', 'delivered', 'sent'].includes(incoming.MessageStatus?.toLowerCase());

    if (isStatus) {
        await Chat.updateOne(
            { messageSid: incoming.MessageSid },
            { $set: { status: incoming.MessageStatus } }
          );
        return;
    }
    const from = incoming.From;
    const waId = incoming.WaId || from.replace('whatsapp:', '');
    const name = incoming.ProfileName || 'Unknown';
    const message = {
        body: incoming.Body,
        timestamp: new Date(),
        media: incoming.NumMedia && parseInt(incoming.NumMedia) > 0 ? true : false,
    };

    await whatsappUser.findOneAndUpdate(
        { number: waId },
        {
            $setOnInsert: { name },
            $push: { messages: message },
        },
        { upsert: true, new: true },
    );
};

const handleTelMessage = async (incoming) => {
    console.log(JSON.stringify(incoming, null, 2));
    throw new Error('Please look into this message - and check its types');
};

exports.handleTwilioWebhook = async (req, res) => {
    const incoming = req.body;

    try {
        let event = incoming.From.startsWith('whatsapp') ? 'whatsapp' : 'tel';
        if (event === 'whatsapp') {
            await handleWhatsappMessage(incoming);
        } else {
            await handleTelMessage(incoming);
        }
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.sendStatus(200);
    }
};
