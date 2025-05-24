const mongoose = require('mongoose');
require('dotenv').config();
const { createDynamicModel } = require('../models/createDynamicModel');
const File = require('../models/File');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const { deleteInvoice } = require('../modules/invoice');
const { sendTelegramMessage } = require('../../akeurope-cp/modules/telegramBot')

const formCollection = mongoose.createConnection(process.env.MONGO_URI_FORMS, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

formCollection.on('connected', () => {
    console.log('Forms MongoDB connected');
});

global.formCollection = formCollection;

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

async function convertUnpaidToExpired(Collection) {
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
        sendTelegramMessage(`Marked ${expiredIds.length} orders as expired`);
    } else {
        console.log('No expired orders found');
    }
}

async function remove600Children() {
    const orderId = '67ded251d39f5002372c600c';
    const order = await Order.findById(orderId);
    const children = order.projects.flatMap(project =>
        project.entries.map(entry => entry.entryId)
    );
    const model = await createDynamicModel('gaza-orphans');
    const childrenWithStatusUpdates = await model.find({ _id: { $in: children }, status: { $ne: 'Pending' } }).select('status');
    console.log('Children with status updates:', childrenWithStatusUpdates.length);
    const File = require('../models/File');
    const childrenObjectIds = children.map(id => new mongoose.Types.ObjectId(id));
    const files = await File.find({ "links.entityId": { $in: childrenObjectIds } });
    const childrenWithFileUploads = new Set();

    files.forEach(file => {
        file.links.forEach(link => {
            if (childrenObjectIds.find(id => id.equals(link.entityId))) {
                childrenWithFileUploads.add(link.entityId.toString());
            }
        });
    });
    console.log('Children with file uploads:', childrenWithFileUploads.size);
    // const fileUploadedStatuses = await model.find({ _id: { $in: Array.from(childrenWithFileUploads) } }).select('status');
    const childrenWithStatusUpdatesIds = childrenWithStatusUpdates.map(child => child._id.toString());
    const unionSet = new Set([...childrenWithStatusUpdatesIds, ...childrenWithFileUploads]);
    const unionIds = Array.from(unionSet).map(id => new mongoose.Types.ObjectId(id));
    console.log('Union of children with status updates and file uploads:', unionIds.length);
    const unionIdStrings = unionIds.map(id => id.toString());
    let modified = false;
    for (const project of order.projects) {
        const originalLength = project.entries.length;

        project.entries = project.entries.filter(entry =>
            unionIdStrings.includes(entry.entryId.toString())
        );

        if (project.entries.length !== originalLength) {
            modified = true;
        }
    }

    await order.save();

    const alreadySelectedEntriesResult = await Order.aggregate([
        {
            $match: {
                _id: { $ne: orderId },
                'projects.slug': 'gaza-orphans',
                status: 'paid',
            },
        },
        {
            $unwind: '$projects',
        },
        {
            $unwind: '$projects.entries',
        },
        {
            $group: {
                _id: null,
                entryIds: { $addToSet: '$projects.entries.entryId' },
            },
        },
        {
            $project: {
                _id: 0,
                entryIds: 1,
            },
        },
    ]);

    const alreadySelectedEntries = alreadySelectedEntriesResult[0]?.entryIds || [];

    console.log('Already selected entries:', alreadySelectedEntries.length);

    const dontSelectTheseIds = new Set([
        ...alreadySelectedEntries.map(id => id.toString()),
        ...children.map(id => id.toString()),
    ]);

    console.log('Dont select these ids:', dontSelectTheseIds.size);

    const mongoIdsToSkip = Array.from(dontSelectTheseIds).map(id => new mongoose.Types.ObjectId(id));

    const pendingChildrenFromNorth = await model.find({ _id: { $nin: mongoIdsToSkip }, status: 'Pending', cluster: 'North' }).limit(261).select('status');
    console.log('Pending children from North:', pendingChildrenFromNorth.length);
    const pendingChildrenFromNorthIds = pendingChildrenFromNorth.map(entry => entry._id);

    const newOrderChildrenIds = new Set([...pendingChildrenFromNorthIds, ...unionIds]);
    const ids = Array.from(newOrderChildrenIds).map(id => new mongoose.Types.ObjectId(id));
    await model.updateMany({ _id: { $in: ids } }, { monthlyExpenses: 581.68 });

    console.log('entries to put in order', newOrderChildrenIds.size);
    let newArray = [];
    for (const childId of newOrderChildrenIds) {
        const child = await model.findById(childId).lean();
        const object = {
            entryId: childId,
            selectedSubscriptions: ['monthlyExpenses'],
            costs: [{
                fieldName: 'monthlyExpenses',
                totalCost: child.monthlyExpenses,
                orderedCost: child.monthlyExpenses,
            }],
            totalCost: child.monthlyExpenses,
            totalCostAllSubscriptions: child.monthlyExpenses
        };
        newArray.push(object);
    }

    for (const project of order.projects) {
        project.entries = newArray;
    }

    await order.save();

}

async function resetGazaOrphanPricesTo600() {
    const model = await createDynamicModel('gaza-orphans');
    const alreadySelectedEntriesResult = await Order.aggregate([
        {
            $match: {
                'projects.slug': 'gaza-orphans',
                status: 'paid',
            },
        },
        {
            $unwind: '$projects',
        },
        {
            $unwind: '$projects.entries',
        },
        {
            $group: {
                _id: null,
                entryIds: { $addToSet: '$projects.entries.entryId' },
            },
        },
        {
            $project: {
                _id: 0,
                entryIds: 1,
            },
        },
    ]);

    const alreadySelectedEntries = alreadySelectedEntriesResult[0]?.entryIds || [];

    console.log('Already selected entries:', alreadySelectedEntries.length);

    const dontSelectTheseIds = new Set([
        ...alreadySelectedEntries.map(id => id.toString()),
    ]);

    console.log('Dont select these ids:', dontSelectTheseIds.size);

    const mongoIdsToSkip = Array.from(dontSelectTheseIds).map(id => new mongoose.Types.ObjectId(id));
    await model.updateMany({ _id: { $nin: mongoIdsToSkip } }, { monthlyExpenses: 600 });
}

async function formatGazaPhoneNos() {
    const model = await createDynamicModel('gaza-orphans');
    const docs = await model.find({}).lean(); // await here to resolve the array

    for (const doc of docs) {
        let { phoneNo1, phoneNo2 } = doc;

        const formatNumber = (num) => {
            if (!num) return null;
            num = num.trim();
            if (num.startsWith('+972')) return num;
            if (num.startsWith('0')) return '+972' + num.slice(1);
            return '+972' + num;
        };

        const updatedPhoneNo1 = formatNumber(phoneNo1);
        const updatedPhoneNo2 = formatNumber(phoneNo2);

        await model.updateOne(
            { _id: doc._id },
            { $set: { phoneNo1: updatedPhoneNo1, phoneNo2: updatedPhoneNo2 } }
        );

        await File.updateMany(
            { "links.entityId": doc._id },
            { $set: { access: ['beneficiary', 'customers'] } }
        );
    }

    console.log('Phone numbers updated successfully.');
}


mongoose.connection.on('open', async () => {
    console.log('Order cleanup job started...');

    await deleteExpiredOrders(Order);
    await deleteExpiredOrders(Subscription);
    await convertUnpaidToExpired(Order);
    // await formatGazaPhoneNos();
    // await remove600Children();
    // await resetGazaOrphanPricesTo600();

    setInterval(async () => {
        try {
            await deleteExpiredOrders(Order);
            await deleteExpiredOrders(Subscription);
            await convertUnpaidToExpired(Order);
        } catch (error) {
            console.error('Error deleting expired orders:', error);
        }
    }, 60 * 1000);
});

module.exports = connectDB;
