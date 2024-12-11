const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        status: {
            type: String,
            enum: ['draft', 'invoice created', 'paid'],
            default: 'draft',
        },
        projects: [
            {
                slug: {
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
