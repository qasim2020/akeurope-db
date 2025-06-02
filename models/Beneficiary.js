const mongoose = require('mongoose');

const BenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
    },
    maxUploads: {
      type: Number,
      default: 4,
    },
    ipCountry: {
      type: String,
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
    password: {
      type: String,
      required: false
    },
    projects: {
      type: [String],
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active'
    },
    resetPasswordToken: {
      type: String,
      unique: true,
      sparse: true
    },
    resetPasswordExpires: {
      type: Date,
      sparse: true
    },
    resetPasswordLink: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = global.formCollection.model('Beneficiary', BenSchema, 'formUsers');
