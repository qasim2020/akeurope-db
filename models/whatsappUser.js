const mongoose = require('mongoose');

const waUserSchema = new mongoose.Schema({
  number: { type: String, required: true},
  name: { type: String, required: true},
  messages: [Object],
},{
  timestamps: true,
  versionKey: '__v',
});

module.exports = mongoose.model('whatsappUser', waUserSchema);
