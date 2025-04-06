const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const { deleteInvoice } = require('../modules/invoice');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('MongoDB connected!');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

async function deleteExpiredOrders(Collection) {

    const expiryTime = new Date(Date.now() - 1 * 60 * 60 * 1000); 

    const expiredOrders = await Collection.find({
        $or: [
            { status: "draft", updatedAt: { $lt: expiryTime } },
            { status: "aborted", updatedAt: { $lt: expiryTime } },
            { status: "pending payment", customerId: process.env.TEMP_CUSTOMER_ID, updatedAt: { $lt: expiryTime } }
        ]
    });

    if (expiredOrders.length > 0) {
        console.log(`Found ${expiredOrders.length} expired orders.`);

        const orderIds = expiredOrders.map((order) => order._id);

        for (const orderId of orderIds) {
            await deleteInvoice(orderId);
        }

        const result = await Collection.deleteMany({ _id: { $in: orderIds } });

        console.log(`Deleted ${result.deletedCount} expired orders.`);
    }

}

async function handleExpiredOrders(Collection) {
    const now = new Date();

    const expiredOrders = await Collection.aggregate([
        {
            $match: {
                status: 'paid',
            },
        },
        {
            $addFields: {
                maxMonths: { $max: '$projects.months' },
            },
        },
        {
            $addFields: {
                expirationDate: {
                    $dateAdd: {
                        startDate: {
                            $dateAdd: {
                                startDate: '$createdAt',
                                unit: 'month',
                                amount: '$maxMonths',
                            },
                        },
                        unit: 'day',
                        amount: 2,
                    },
                },
            },
        },
        {
            $match: {
                expirationDate: { $lte: now },
            },
        },
        {
            $project: { _id: 1 },
        },
    ]);

    const expiredIds = expiredOrders.map(order => order._id);

    if (expiredIds.length) {
        await Collection.updateMany(
            { _id: { $in: expiredIds } },
            { $set: { status: 'expired' } }
        );
        console.log(`Marked ${expiredIds.length} orders as expired`);
    } else {
        console.log('No expired orders found');
    }
}


mongoose.connection.on('open', async () => {
    console.log('Order cleanup job started...');

    await deleteExpiredOrders(Order);
    await deleteExpiredOrders(Subscription);
    await handleExpiredOrders(Order);

    setInterval(async () => {
        try {
            await deleteExpiredOrders(Order);
            await deleteExpiredOrders(Subscription);
        } catch (error) {
            console.error('Error deleting expired orders:', error);
        }
    }, 60 * 1000); 
});

module.exports = connectDB;
