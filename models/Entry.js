const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema(
    {
        entryId: mongoose.Schema.Types.ObjectId,
        projectSlug: String,
        isExpired: Boolean,
        reasonExpiry: String,
    },
    {
        versionKey: true,
        timestamps: true
    }
);

const Entry = mongoose.model('Entry', EntrySchema);

module.exports = Entry;
