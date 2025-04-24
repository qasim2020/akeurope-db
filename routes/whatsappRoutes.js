const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const whatsappController = require('../controllers/whatsappController');
const twilioController = require('../controllers/twilioController');
const { verifyTwilioWebhook } = require('../modules/twilio');

router.get('/validate-phone-number/:phoneNo', authenticate, authorize('chat'), whatsappController.validatePhoneNo);
router.get(`/start-beneficiary-chat/:slug/:entryId/:phoneNo`, authenticate, authorize('chat'), whatsappController.chatModal);
router.post(
    '/twilio-webhook',
    express.urlencoded({ extended: false }),
    verifyTwilioWebhook,
    twilioController.handleTwilioWebhook,
);

module.exports = router;
