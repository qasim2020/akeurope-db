const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: 'donor' },
    organization: { type: String },
    address: { type: String },
    password: { type: String },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    emailStatus: { type: String },
    tel: { type: String },
    emailStatusUpdates: { type: Boolean, default: true },
    phoneStatusUpdates: { type: Boolean, default: true },
    organization: { type: String },
    anonymous: { type: String },
    countryCode: { type: String },
    inviteToken: String,
    inviteExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});

module.exports = mongoose.model('Customer', CustomerSchema);
