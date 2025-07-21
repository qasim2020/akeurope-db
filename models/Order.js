const mongoose = require('mongoose');
const Counter = require('../models/Counter');

const EntrySchema = new mongoose.Schema(
    {
        entryId: mongoose.Schema.Types.ObjectId,
        selectedSubscriptions: [String],
        totalCost: Number,
        totalCostAllSubscriptions: Number,
        costs: [Object],
    },
    { _id: false }
);

const ProjectSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
        },
        months: {
            type: Number,
            required: true,
        },
        totalCostSingleMonth: Number,
        totalCostAllMonths: Number,
        totalCost: Number,
        totalSubscriptionCosts: [Object],
        entries: [EntrySchema],
    },
    { _id: false }
);

const OrderSchema = new mongoose.Schema(
    {
        orderNo: {
            type: Number,
            unique: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        status: {
            type: String,
            enum: ['draft', 'pending payment', 'processing', 'paid', 'expired'], 
            default: 'draft',
        },
        currency: {
            type: String,
            enum: ['USD', 'NOK', 'SEK', 'GBP', 'EUR', 'PKR', 'ILS', 'EGP'],
            default: 'USD',
            required: true,
        },
        totalCost: Number,
        projects: [ProjectSchema],
        monthlySubscription: {
            type: Boolean,
        },
        totalCostSingleMonth: {
            type: Number,
        },
        countryCode: {
            type: String,
        },
        // Additional fields for tracking expiry
        expiresAt: {
            type: Date,
        },
        expiredReason: {
            type: String,
            enum: ['payment_failed', 'subscription_cancelled', 'time_expired', 'manual_expiry'],
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Pre-save middleware for order numbering
OrderSchema.pre('save', async function (next) {
    const doc = this;

    if (doc.orderNo) return next();

    try {
        const counter = await Counter.findOneAndUpdate(
            { _id: 'Order' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true },
        );
        doc.orderNo = counter.seq;
        next();
    } catch (error) {
        next(error);
    }
});

// Index for efficient querying of expired orders
OrderSchema.index({ customerId: 1, status: 1 });
OrderSchema.index({ expiresAt: 1, status: 1 });

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;