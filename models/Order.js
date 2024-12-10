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
        currency: {
            type: String,
            default: 'USD'
        },
        projects: [
            {
                slug: {
                    type: String,
                    required: true,
                    ref: 'Project', 
                },
                entries: [
                    {
                        _id: {
                            type: mongoose.Schema.Types.ObjectId,
                            required: true
                        }, 
                        subscriptions: [
                            {
                                subscription: String,
                                subCost: Number
                            }
                        ],
                        rowCost: Number
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

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
