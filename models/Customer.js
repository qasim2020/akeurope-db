const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    organization: { type: String },
    location: { type: String },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    projects: [{ type: String, ref: 'Project' }],
    inviteToken: String,
    inviteExpires: Date
});

module.exports = mongoose.model('Customer', CustomerSchema);