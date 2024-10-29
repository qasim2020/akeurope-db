const User = require('../models/User');

exports.resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send("Password reset token is invalid or has expired.");
    }

    user.password = password;
    user.resetPasswordToken = undefined; // Clear reset token
    user.resetPasswordExpires = undefined; // Clear token expiration
    await user.save();

    res.status(200).send("Password changed.");
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).send(error);
  }
};
