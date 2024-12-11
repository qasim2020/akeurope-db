const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ['draft', 'invoice created', 'paid'],
            default: 'draft',
        },
        grandTotal: {
            type: Number,
            required: true,
            min: 0,
        },
        projects: [
            {
                slug: {
                    type: String,
                    required: true,
                },
                currency: {
                    type: String,
                    required: true,
                },
                months: {
                    type: Number,
                    required: true
                },
                entries: [
                    {
                        entryId: mongoose.Schema.Types.ObjectId,
                        selectedSubscriptions: [String],
                    },
                ],
            },
        ],
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;
