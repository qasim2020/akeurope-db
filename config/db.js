const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('../models/Order');
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

mongoose.connection.on('open', () => {
    console.log('Order cleanup job started...');

    setInterval(async () => {
        try {
            const expiryTime = new Date(Date.now() - 15 * 60 * 1000); // 30 seconds ago

            const expiredOrders = await Order.find({
                $or: [
                    { status: "draft", updatedAt: { $lt: expiryTime } },
                    { status: "pending payment", customerId: "67af1a4174f0dfae5f0ead1b", updatedAt: { $lt: expiryTime } }
                ]
            });

            if (expiredOrders.length > 0) {
                console.log(`Found ${expiredOrders.length} expired orders.`);

                const orderIds = expiredOrders.map((order) => order._id);

                for (const orderId of orderIds) {
                    await deleteInvoice(orderId);
                }

                const result = await Order.deleteMany({ _id: { $in: orderIds } });

                console.log(`Deleted ${result.deletedCount} expired orders.`);
            }
        } catch (error) {
            console.error('Error deleting expired orders:', error);
        }
    }, 60 * 1000); // Runs every 60 sec
});

module.exports = connectDB;
