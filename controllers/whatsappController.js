const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const Chat = require('../models/Chat');
const Project = require('../models/Project');
const { createDynamicModel } = require('../models/createDynamicModel');

exports.validatePhoneNo = async (req, res) => {
    try {
        const rawNumber = req.params.phoneNo;

        if (!rawNumber) {
            return res.status(400).json({ message: 'Phone number is required.' });
        }

        const phoneNumber = rawNumber.trim();

        const lookupResult = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({ type: ['carrier'] });

        if (!lookupResult.valid) {
            return res.status(400).json({ message: 'This number is not a valid mobile number for WhatsApp.' });
        }

        res.status(200).send(lookupResult.phoneNumber);
    } catch (error) {
        console.error(error);
        res.status(500).json(error.message);
    }
};

exports.chatModal = async (req, res) => {
    try {
        const rawNumber = req.params.phoneNo;
        const slug = req.params.slug;
        const entryId = req.params.entryId;

        if (!rawNumber || !slug || !entryId)
            throw new Error('Incomplete parameters');

        const project = await Project.findOne({slug}).lean();
        const model = await createDynamicModel(slug);
        const entry = await model.findOne({_id: entryId}).lean();

        if (!entry || !project)
            throw new Error('Entry or Project not found!');

        const allowedProjects = req.session.user?.projects;

        if (!allowedProjects.includes(project.slug))
            throw new Error('User does not have access to this project');


        const safePhoneId = rawNumber.replace(/[^\w\-]/g, '');

        return res.render('partials/whatsappModal', {
            layout: false,
            data: {
                phoneNo: safePhoneId,
            },
        });

        const formattedPhone = rawNumber.replace(/[^+\d]/g, '').replace(/^00/, '+');

        const sent = await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${formattedPhone}`,
            contentSid: process.env.TWILIO_ARABIC_TEMPLATE_ID,
            contentVariables: JSON.stringify({ 1: entry.name }),
        });

        await Chat.create({
            senderId: req.session.user?._id,
            from: sent.from,
            to: sent.to,
            message: sent.body,
            status: sent.status,
            messageSid: sent.sid
        });

    } catch (error) {
        console.error(error);
        res.status(500).json(error.message);
    }
};
