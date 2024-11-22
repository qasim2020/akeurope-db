const User = require('../models/User'); // Adjust the path as necessary
const path = require('path');

exports.resetPasswordForm = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure token is not expired
    });

    if (!user) {
      return res.status(400).render('error', { heading: "Expired link", error: 'Password reset token is invalid or has expired.' });
    }

    // If valid, render the reset password form
    res.render('reset-password', { email: user.email, token: req.params.token });
  } catch (error) {
    console.error('Error in resetPasswordForm:', error);
    res.status(500).send('Server error');
  }
};
