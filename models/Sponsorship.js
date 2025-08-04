const mongoose = require('mongoose');

const SponsorshipSchema = new mongoose.Schema(
    {
        entryId: mongoose.Schema.Types.ObjectId,
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
        },
        projectSlug: String,
        startedAt: Date,
        stoppedAt: Date,
        reasonStopped: String,
        daysSponsored: Number,
        totalPaid: String,
    },
    {
        versionKey: false,
        timestamps: true
    }
);

SponsorshipSchema.index({ customerId: 1, entryId: 1, orderId: 1 });

const Sponsorship = mongoose.model('Sponsorship', SponsorshipSchema);

module.exports = Sponsorship;
