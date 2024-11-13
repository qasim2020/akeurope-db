const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: 'viewer' }, 
    organization: { type: String },
    location: { type: String },
    password: { type : String },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    emailStatus: { type: String },
    projects: [{ type: String, ref: 'Project' }],
    subscriptions: [{ type: mongoose.Types.ObjectId }],
    inviteToken: String,
    inviteExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
});


module.exports = mongoose.model('Customer', CustomerSchema);