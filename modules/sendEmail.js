require('dotenv').config();
const mailchimp = require('@mailchimp/mailchimp_transactional')(process.env.MAILCHIMP_API_KEY);

const sendEmail = async (to, subject, htmlContent) => {
  console.log(process.env.MAILCHIMP_API_KEY);
  const response2 = await mailchimp.users.ping();
  console.log(response2);

  const response = await mailchimp.messages.send({
    message: {
      from_email: 'info@akeurope.org',
      subject: subject,
      html: htmlContent,
      to: [
        {
          email: to,
          type: 'to',
        },
      ],
    },
  });

  if (response && response[0] && response[0].status === 'sent') {
    return { success: true, data: response };
  } else {
    console.log(response);
    const errorMessage =
      response && response[0] && response[0].reject_reason
        ? response[0].reject_reason
        : 'Unknown error';
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};


module.exports = { sendEmail };