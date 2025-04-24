const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId },
  from: { type: String, required: true},
  to: { type: String, required: true},
  message: { type: String, required: true },
  status: { type: String, required: true },
  messageSid: { type: String, required: true},
},{
  timestamps: true,
  versionKey: '__v',
});

module.exports = mongoose.model('Chat', chatSchema);
