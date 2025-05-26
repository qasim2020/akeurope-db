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
    projects: {
      type: [String],
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = global.formCollection.model('Beneficiary', BenSchema, 'formUsers');
