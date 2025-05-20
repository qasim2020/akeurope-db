const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BenSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  maxUploads: {
    type: Number,
    default: 1,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = global.formCollection.model('Beneficiary', BenSchema, 'formUsers');
