const mongoose = require('mongoose');
require('dotenv').config();

const formCollection = mongoose.createConnection(process.env.MONGO_URI_FORMS, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

formCollection.on('connected', () => {
    console.log('Forms MongoDB connected');
});

global.formCollection = formCollection;

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const { createDynamicModel } = require('../models/createDynamicModel');
const File = require('../models/File');
const Log = require('../models/Log');
const Beneficiary = require('../models/Beneficiary');
const Chat = require('../models/Chat');
const Order = require('../models/Order');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Donor = require('../models/Donor');
const { saveLog } = require('../modules/logAction');
const { deleteInvoice } = require('../modules/invoice');
const { sendTelegramMessage, sendErrorToTelegram } = require('../../akeurope-cp/modules/telegramBot')
const { formatDate, getAgeInYearsAndMonths, slugToString } = require('../modules/helpers');
const { getCurrencyRates } = require('../modules/getCurrencyRates');
const { logTemplates } = require('../modules/logTemplates');
const { getMonthlyTriggerDates } = require('../modules/orders');
const emailConfig = require('../config/emailConfig.js');
const { getPortalUrl } = require('../modules/emails');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const Project = require('../models/Project.js');

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

async function deleteDraftOrders(Collection) {

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

    const orders = await Collection.find({ createdAt: { $lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, status: 'paid' });

    const message = [];
    for (const order of orders) {
        const triggerDates = getMonthlyTriggerDates(order.createdAt);
        if (order.projects?.length > 1) {
            sendTelegramMessage(`Order ${order._id} has more than one project, skipping expiry test...`);
            continue;
        }
        const project = order.projects[0];
        const months = project.months;
        const requiredCharges = triggerDates.filter(date => date < now);
        if (months < requiredCharges.length) {
            const pendingDate = requiredCharges[months];
            const pendingDays = (pendingDate - now) / (1000 * 60 * 60 * 24);
            if (pendingDays < -5) {
                await Collection.updateOne({ _id: order._id }, { $set: { status: 'expired' } });
                console.log(`Order ${order._id} | ${order.orderNo} in ${project.slug} | Monthly Subscription: ${order.monthlySubscription} | marked as expired.`);
                message.push(`Order ${order._id} | ${order.orderNo} in ${project.slug} | Monthly Subscription: ${order.monthlySubscription} | marked as expired.`);
            } else {
                console.log(`Order ${order._id} | ${order.orderNo} in ${project.slug} | Monthly Subscription: ${order.monthlySubscription} | will expire after ${Math.ceil(pendingDays + 5)} days.`);
                message.push(`Order ${order._id} | ${order.orderNo} in ${project.slug} | Monthly Subscription: ${order.monthlySubscription} | will expire after ${Math.ceil(pendingDays + 5)} days.`);
            }
        }
    };

    const messages = message.join('\n')
    sendTelegramMessage(messages);

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
    const childrenWithStatusUpdatesIds = childrenWithStatusUpdates.map(child => child._id.toString());
    const unionSet = new Set([...childrenWithStatusUpdatesIds, ...childrenWithFileUploads]);
    const unionIds = Array.from(unionSet).map(id => new mongoose.Types.ObjectId(id));
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

    const dontSelectTheseIds = new Set([
        ...alreadySelectedEntries.map(id => id.toString()),
        ...children.map(id => id.toString()),
    ]);

    const mongoIdsToSkip = Array.from(dontSelectTheseIds).map(id => new mongoose.Types.ObjectId(id));

    const pendingChildrenFromNorth = await model.find({ _id: { $nin: mongoIdsToSkip }, status: 'Pending', cluster: 'North' }).limit(261).select('status');
    const pendingChildrenFromNorthIds = pendingChildrenFromNorth.map(entry => entry._id);

    const newOrderChildrenIds = new Set([...pendingChildrenFromNorthIds, ...unionIds]);
    const ids = Array.from(newOrderChildrenIds).map(id => new mongoose.Types.ObjectId(id));
    await model.updateMany({ _id: { $in: ids } }, { monthlyExpenses: 581.68 });

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

async function sendWhatsappMessageWithFormLink(pending) {
    try {
        const formattedPhone = '+4792916580';
        const response = await twilioClient.messages.create({
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${formattedPhone}`,
            contentSid: process.env.TWILIO_TEMPLATE_ID,
            contentVariables: JSON.stringify({ 1: 'Qasim', 2: 'Norway' }),
        });
        const chat = new Chat({
            senderId: new mongoose.Types.ObjectId(),
            senderType: 'system',
            from: response.from,
            to: response.to,
            message: response.body,
            status: response.status,
            messageSid: response.sid,
        });
        await chat.save();
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message || error.response?.data || error);
    }
}

async function handleGazaOrphanForm() {
    function getDaysDiff(createdAt) {
        const now = new Date();
        const diffInMs = now - createdAt;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
        return diffInDays;
    }
    const model = await createDynamicModel('gaza-orphans');
    const docs = await model.find({}).limit().lean();
    let pending = [];
    let done = [];
    let statusMessages = [];
    let fileMessages = []
    let error = [];
    for (const doc of docs) {
        const files = await File.find({ "links.entityId": doc._id }).sort({ createdAt: -1 });
        if (files.length > 0) {
            const diffInDays = getDaysDiff(new Date(files[0].createdAt));
            if (diffInDays > 6) {
                pending.push({ entryId: doc._id, phoneNo1: doc.phoneNo1, phoneNo2: doc.phoneNo2 });
            } else {
                fileMessages.push(`${doc.name} | ${doc.status.slice(0, 20)}... | ${files[0].name} | file added ${Math.ceil(diffInDays)} days ago - check status is ok`);
                done.push({ entryId: doc._id, phoneNo1: doc.phoneNo1, phoneNo2: doc.phoneNo2 });
            }
        } else {
            const logs = await Log.find({ entityId: doc._id, entityType: 'entry', changes: { $exists: true } }).select('action changes timestamp').sort({ timestamp: -1 }).lean();
            if (logs.length > 1) {
                const diffInDays = getDaysDiff(new Date(logs[0].timestamp));
                if (diffInDays > 6) {
                    pending.push({ entryId: doc._id, phoneNo1: doc.phoneNo1, phoneNo2: doc.phoneNo2 });
                } else {
                    const logStatus = logs.find(log => log.changes.find(fd => fd.key === 'status')).changes.find(fd => fd.key === 'status');
                    if (logStatus) {
                        statusMessages.push(`${doc.name} | ${doc.status.slice(0, 20)}... | ${logStatus.newValue.slice(0, 20)} | status sent ${Math.ceil(diffInDays)} days ago`);
                        done.push({ entryId: doc._id, phoneNo1: doc.phoneNo1, phoneNo2: doc.phoneNo2 });
                    } else {
                        error.push(`${doc._id} | ${doc.status.slice(0, 50)}... | ${log} | Log is not a status update = check if this is ok`);
                        pending.push({ entryId: doc._id, phoneNo1: doc.phoneNo1, phoneNo2: doc.phoneNo2 });
                    }
                }
            } else {
                pending.push({ entryId: doc._id, phoneNo1: doc.phoneNo1, phoneNo2: doc.phoneNo2 });
                error.push(`${doc._id} does not have any log. check this please.`);
            }
        }
    };
    console.log({ Done: done.length, Pending: pending.length });
    console.error(error);
    console.log(statusMessages);
    console.log(fileMessages);
    if (error.length > 0) {
        await sendErrorToTelegram(error.join('\n\n'));
    }
    const combinedMessages = [...statusMessages, ...fileMessages];
    combinedMessages.unshift(`Message will not be sent to ${combinedMessages.length} children guardians.\n\n`)
    await sendTelegramMessage(combinedMessages.join('\n'));
    const combinedEntries = [...done, ...pending];
    const phoneNo1s = combinedEntries.map(val => val.phoneNo1);
    const phoneNo2s = combinedEntries.map(val => val.phoneNo2);
    const combinedPhoneNos = new Set([...phoneNo1s, ...phoneNo2s]);
    let beneficiaries = [];
    for (const phoneNumber of combinedPhoneNos) {
        const beneficiary = await Beneficiary.findOneAndUpdate(
            { phoneNumber },
            {
                $set: {
                    phoneNumber,
                },
                $setOnInsert: {
                    verified: false,
                    projects: ['gaza-orphans']
                }
            },
            {
                upsert: true,
                new: true
            }
        );
        beneficiaries.push(beneficiary);
    };
    console.log(`✅ ${beneficiaries.length} added to Beneficiary collection`);
}

async function createDirectDonorGazaUpdate() {
    function getDaysDiff(createdAt) {
        const now = new Date();
        const diffInMs = now - createdAt;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
        return diffInDays;
    }

    const model = await createDynamicModel('gaza-orphans');
    const orders = await Order.find({
        'projects.slug': 'gaza-orphans',
        status: 'paid',
        customerId: {
            $nin: [
                new mongoose.Types.ObjectId('68496e48dbce9ead4cd7fc53'),
                new mongoose.Types.ObjectId('67dd7d90d39f5002372bba2a')
            ]
        }
    }).lean();

    let error = [];
    let entries = [];

    for (const order of orders) {
        const project = order.projects.find(prj => prj.slug === 'gaza-orphans');
        if (!project) continue;
        const customer = await Customer.findById(order.customerId).lean();
        for (const orderEntry of project.entries) {
            const entryId = orderEntry.entryId;
            const doc = await model.findOne({ _id: entryId }).select('ser name gender orphanId dateOfBirth fatherDateOfDeath guardianName guardianId phoneNo1 phoneNo2 displacementGov displacementArea orphanAddress relationToTheOrphan cluster status').lean();
            const files = await File.find({ "links.entityId": doc._id }).sort({ createdAt: -1 });
            if (files.length > 0) {
                const diffInDays = getDaysDiff(new Date(files[0].createdAt));
                if (diffInDays > 6) {
                    doc.photoVideoUpdate = `Pending | File uploaded ${Math.ceil(diffInDays)} days ago.`;
                } else {
                    doc.photoVideoUpdate = `Done | File uploaded ${Math.ceil(diffInDays)} days ago`;
                }
            } else {
                doc.photoVideoUpdate = `Pending | No file uploaded yet.`;
            }
            const logs = await Log.find({ entityId: doc._id, entityType: 'entry', changes: { $exists: true } }).select('action changes timestamp').sort({ timestamp: -1 }).lean();
            if (logs.length > 1) {
                const diffInDays = getDaysDiff(new Date(logs[0].timestamp));
                if (diffInDays > 30) {
                    doc.statusUpdate = `Pending | Update sent ${Math.ceil(diffInDays)} days ago.`;
                } else {
                    const logStatus = logs.find(log => log.changes.find(fd => fd.key === 'status')).changes.find(fd => fd.key === 'status');
                    if (logStatus) {
                        doc.statusUpdate = `Done | Update sent ${Math.ceil(diffInDays)} days ago`;
                    } else {
                        error.push(`${doc._id} | ${doc.status.slice(0, 50)}... | Log is not a status update = check if this is ok`);
                    }
                }
            } else {
                doc.statusUpdate = `Pending | ${doc.name} does not have any log. Check this please.`;
            }
            doc.donor = customer.name;
            doc.dateOfBirth = formatDate(doc.dateOfBirth);
            doc.fatherDateOfDeath = formatDate(doc.fatherDateOfDeath);
            doc.address = `${doc.displacementGov} ${doc.displacementArea} ${doc.orphanAddress}`;
            doc.phoneNo1 = doc.phoneNo1.replace(/(.{4})/g, '$1 ').trim();
            doc.phoneNo2 = doc.phoneNo2.replace(/(.{4})/g, '$1 ').trim();
            delete doc.displacementGov;
            delete doc.displacementArea;
            delete doc.orphanAddress;
            delete doc._id;
            const tarteeb = {
                Ser: doc.ser,
                'Orphan ID': doc.orphanId,
                Name: doc.name,
                Donor: customer.name,
                'Long Update': doc.statusUpdate,
                'File Upload': doc.photoVideoUpdate,
                Guardian: `${doc.guardianName} (${doc.relationToTheOrphan})`,
                'Guardian Phone No 1': doc.phoneNo1,
                'Guardian Phone No 2': doc.phoneNo2,
                'Guardian ID': doc.guardianId,
                DOB: doc.dateOfBirth,
                FDOD: doc.fatherDateOfDeath,
                Cluster: doc.cluster,
                Address: doc.address,
                'Current Status': doc.status
            };
            entries.push(tarteeb);
        }
    }
    if (error.length > 0) {
        await sendErrorToTelegram(error.join('\n\n'));
    }
    exportToCSV(entries, `gaza-${formatDate(Date.now())}.csv`);
}

async function createDirectDonorPakistanStudentUpdate() {
    function getDaysDiff(createdAt) {
        const now = new Date();
        const diffInMs = now - createdAt;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
        return diffInDays;
    }

    const model = await createDynamicModel('alfalah-student-scholarship-2025');
    const orders = await Order.find({
        'projects.slug': 'alfalah-student-scholarship-2025',
        status: 'paid',
        customerId: {
            $nin: [
                new mongoose.Types.ObjectId('6792d001b5a200b74a21d8be'),
            ]
        }
    }).lean();

    let error = [];
    let entries = [];

    for (const order of orders) {
        const project = order.projects.find(prj => prj.slug === 'alfalah-student-scholarship-2025');
        if (!project) continue;
        const customer = await Customer.findById(order.customerId).lean();
        for (const orderEntry of project.entries) {
            const entryId = orderEntry.entryId;
            await model.updateOne({ _id: entryId }, { status: 'Active' });
            const doc = await model.findOne({ _id: entryId }).lean();
            const files = await File.find({ "links.entityId": doc._id }).sort({ createdAt: -1 });
            if (files.length > 0) {
                const diffInDays = getDaysDiff(new Date(files[0].createdAt));
                if (diffInDays > 30) {
                    doc.photoVideoUpdate = `Pending | File uploaded ${Math.ceil(diffInDays)} days ago.`;
                } else {
                    doc.photoVideoUpdate = `Done | File uploaded ${Math.ceil(diffInDays)} days ago`;
                }
            } else {
                doc.photoVideoUpdate = `Pending | No file uploaded yet.`;
            }
            const logs = await Log.find({ entityId: doc._id, entityType: 'entry' }).select('action changes timestamp').sort({ timestamp: -1 }).lean();
            if (logs.length > 1) {
                const statusLogs = logs.filter(log => (log.changes.some(fd => fd.key === 'status') || log.action.includes('status') || log.action.includes('Report')));
                if (statusLogs.length == 0) {
                    doc.statusUpdate = `Pending | No status update found.`;
                } else {
                    let latestStatusUpdate = statusLogs[0];
                    const diffInDays = getDaysDiff(new Date(latestStatusUpdate.timestamp));
                    if (diffInDays > 30) {
                        doc.statusUpdate = `Pending | Update sent ${Math.ceil(diffInDays)} days ago.`;
                    } else {
                        doc.statusUpdate = `Done | Update sent ${Math.ceil(diffInDays)} days ago`;
                    }
                }
            } else {
                doc.statusUpdate = `Pending | ${doc.name} does not have any log. Check this please.`;
            }
            const tarteeb = {
                Ser: doc.ser,
                'Reg No': doc.registrationNo,
                Name: doc.name,
                Gender: doc.gender,
                Father: doc.fatherName,
                District: doc.district,
                Donor: customer.name,
                'Status Update': doc.statusUpdate,
                'File Upload': doc.photoVideoUpdate,
                Institute: `${doc.institute} (${doc.classCategory}, ${doc.class})`,
                'Scholarship Rate': `${doc.scholarshipRate} PKR`,
                'Scholarship Start Date': formatDate(doc.scholarshipStartDate),
                'Scholarship End Date': formatDate(doc.scholarshipEndDate),
                'Current Status': doc.status
            };
            entries.push(tarteeb);
        }
    }
    if (error.length > 0) {
        await sendErrorToTelegram(error.join('\n\n'));
    }
    exportToCSV(entries, `alfalah-${formatDate(Date.now())}.csv`);
}

async function handleEgyptFamilyUsers() {
    const model = await createDynamicModel('egypt-family');
    const beneficiaries = await Beneficiary.find({ projects: 'egypt-family', verified: true }).lean();
    for (const beneficiary of beneficiaries) {
        const entry = await model.findOne({
            'uploadedBy.actorId': beneficiary._id.toString(),
        }).select('name _id').lean();
        if (!entry) {
            console.log(beneficiary);
            continue;
        }
        await Beneficiary.updateOne(
            { _id: beneficiary._id },
            {
                $set: {
                    name: entry.name || 'Not filled in',
                }
            }
        );
    };
};

async function handleGazaBeneficiaries() {
    const model = await createDynamicModel('gaza-orphans');
    const beneficiaries = await Beneficiary.find({ projects: 'gaza-orphans' }).lean();
    for (const beneficiary of beneficiaries) {
        const entry = await model.findOne({
            $or: [
                { phoneNo1: { $in: beneficiary.phoneNumber } },
                { phoneNo2: { $in: beneficiary.phoneNumber } }
            ]
        }).select('guardianName').lean();
        if (!entry) {
            console.log('No entry found for beneficiaries');
            return;
        }
        await Beneficiary.updateOne(
            { _id: beneficiary._id },
            {
                $set: {
                    name: entry.guardianName,
                }
            }
        );
    };
};

async function calculateRevenueFromOrders() {
    const orders = [
        ...await Order.find({ status: 'paid' }).lean(),
        ...await Subscription.find({ status: 'paid' }).lean()
    ];

    let revenue = 0;
    const rateCache = new Map();

    for (const order of orders) {
        let currencyRate;

        if (rateCache.has(order.currency)) {
            currencyRate = rateCache.get(order.currency);
        } else {
            const currencyRates = await getCurrencyRates(order.currency);
            currencyRate = parseFloat(currencyRates.rates.get('NOK').toFixed(2));
            rateCache.set(order.currency, currencyRate);
        }

        const totalCost = order.total || order.totalCost;
        revenue += totalCost * currencyRate;
    }
    console.log(revenue, 'revenue calculated');
};

async function getOrderType(orderId) {
    const order = await Order.findById(orderId).lean() || await Subscription.findById(orderId).lean();
    const customer = await Customer.findById(order.customerId).lean();
    const donor = await Donor.findOne({ email: customer.email }).lean();

    if (!donor) {
        return {
            type: 'manual one time',
            amount: `${order.total || order.totalCost} ${order.currency}`,
            date: formatDate(order.createdAt),
            payments: '1',
        }
    }

    const allPayments = [
        ...(donor.payments ?? []),
        ...(donor.subscriptions ?? []),
        ...(donor.vippsCharges ?? []),
        ...(donor.vippsPayments ?? []),
    ];

    const paymentsWithTypes = [];

    for (const payment of allPayments) {
        const currency = payment.currency?.toUpperCase() || payment.amount.currency.toUpperCase();
        let amount, method, orderId, vippsReference, date;

        if (payment.agreementId) {
            date = payment.due;
            amount = payment.amount / 100;
            method = 'vipps subscription';
            orderId = payment.externalId;
        } else if (payment.price) {
            date = payment.currentPeriodStart;
            amount = payment.price / 100;
            method = 'stripe subscription';
            orderId = payment.orderId;
        } else if (payment.paymentMethod) {
            date = order.createdAt;
            amount = payment.amount.value / 100;
            method = 'vipps one-time';
            vippsReference = payment.reference;
        } else {
            date = payment.created;
            amount = payment.amount;
            method = 'stripe one-time';
            orderId = payment.orderId;
        }

        paymentsWithTypes.push({
            date,
            amount,
            method,
            orderId,
            vippsReference,
            currency,
        })

    };

    let type = {};
    const paymentsOnOrder = [];

    for (const payment of paymentsWithTypes) {
        const isOrderMatch = payment.orderId?.toString() === order._id.toString();
        const isVippsMatch = order.vippsReference && order.vippsReference === payment.vippsReference;

        if (isOrderMatch || isVippsMatch) {
            type = {
                orderId: payment.orderId || payment.vippsReference,
                type: payment.method,
                amount: `${payment.amount} ${payment.currency}`,
                date: formatDate(order.createdAt),
            }
            paymentsOnOrder.push({
                orderId: payment.orderId || payment.vippsReference,
                type: payment.method,
                amount: `${payment.amount} ${payment.currency}`,
                date: formatDate(payment.date),
            });
        };
        // if (customer.name === 'Ismail Oucheni') {
        //     console.log(order._id);
        //     console.log(payment.orderId);
        //     console.log(payment);
        //     console.log(type);
        //     console.log(paymentsOnOrder);
        //     console.log('---------------------------------');
        //     throw new Error('Debugging Ismail Oucheni');
        // };
    }

    if (paymentsOnOrder.length === 0) {
        return {
            type: 'manual one time',
            amount: `${order.total || order.totalCost} ${order.currency}`,
            date: formatDate(order.createdAt),
            payments: '1',
        }
    } else {
        return {
            ...type,
            payments: paymentsOnOrder,
        };
    }
};

async function calculateRevenueFromDonor() {
    const donors = await Donor.find({
        $or: [
            { payments: { $exists: true, $ne: [] } },
            { subscriptions: { $exists: true, $ne: [] } },
            { vippsCharges: { $exists: true, $ne: [] } },
            { vippsPayments: { $exists: true, $ne: [] } }
        ]
    }).sort({ createdAt: -1 }).lean();

    let revenue = 0;
    const rateCache = new Map();

    let array = [];

    for (const donor of donors) {
        let currencyRate;

        const allPayments = [
            ...(donor.payments ?? []),
            ...(donor.subscriptions ?? []),
            ...(donor.vippsCharges ?? []),
            ...(donor.vippsPayments ?? []),
        ];

        if (donor.email === 'nida@sarahalidigital.com') {
            continue;
        }

        for (const payment of allPayments) {

            const currency = payment.currency?.toUpperCase() || payment.amount.currency.toUpperCase();
            let amount;
            let method = [];
            let query = {};
            let date;
            if (payment.agreementId) {
                date = payment.due;
                amount = payment.amount / 100;
                method = 'vipps subscription';
                query = { _id: payment.externalId };
            } else if (payment.price) {
                date = payment.currentPeriodStart;
                amount = payment.price / 100;
                method = 'stripe subscription';
                query = { _id: payment.orderId };
            } else if (payment.paymentMethod) {
                amount = payment.amount.value / 100;
                method = 'vipps one-time';
                query = { vippsReference: payment.reference };
            } else {
                date = payment.created;
                amount = payment.amount;
                method = 'stripe one-time';
                query = { _id: payment.orderId };
            }

            const order = (await Order.findOne(query).lean()) || (await Subscription.findOne(query).lean());

            if (!order) {
                console.log(donor.email);
                console.log(payment);
                continue;
            };

            if (payment.paymentMethod) {
                date = order.createdAt;
            }

            const slug = order.projects && order.projects.length > 0 ? order.projects[0].slug : order.projectSlug;
            const project = slugToString(slug);

            if (rateCache.has(currency)) {
                currencyRate = rateCache.get(currency);
            } else {
                const currencyRates = await getCurrencyRates(currency);
                currencyRate = parseFloat(currencyRates.rates.get('NOK').toFixed(2));
                rateCache.set(currency, currencyRate);
            }

            if (!date) {
                console.log(payment);
                throw new Error('no date found')
            }

            array.push({
                date: order.createdAt,
                month: new Date(date).getMonth() + 1,
                project,
                orderNo: Number(order.orderNo),
                email: donor.email,
                method,
                originalPaid: `${amount} ${currency}`,
                convertedNOK: `${(amount * currencyRate).toFixed(2)}`,
            });

            revenue += amount * currencyRate;
        };

    }

    exportToCSV(array, 'revenue.csv');
}

function exportToCSV(array, filename = 'export.csv') {
    if (!Array.isArray(array) || array.length === 0) return;

    const headers = Object.keys(array[0]);
    const csvRows = [
        headers.join(','), // header row
        ...array.map(row =>
            headers.map(field => {
                const value = row[field] ?? '';
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',')
        )
    ];

    fs.writeFileSync(path.join(__dirname, filename), csvRows.join('\n'), 'utf8');
    console.log(`✅ Exported ${filename}`);
}

function norwayPhoneNo(phone) {
    if (typeof phone !== 'string') {
        phone = phone.toString();
    }
    phone = phone.replace(/[^\d+]/g, '');

    if (phone.startsWith('+')) return phone;

    if (phone.startsWith('0')) phone = phone.slice(1);

    const len = phone.length;

    if (len === 8) {
        return `+47${phone}`;
    }

    return phone;
}

async function readKontakterSolidus() {
    try {
        const filePath = path.join(__dirname, 'kontakter.xlsx');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.worksheets[0];
        const rows = [];

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            rows.push(row.values.slice(1));
        });

        const headers = rows[0];
        const dataRows = rows.slice(1);
        const jsonData = dataRows.map(row => {
            return headers.reduce((acc, key, idx) => {
                acc[key] = row[idx] ?? '';
                return acc;
            }, {});
        });

        const solidusCustomers = jsonData.map(row => {
            const email = row['Email'];
            const tel = row['Phone'] || row['Mobile'];
            if (!email) return null;
            return {
                name: `${row['First name']} | ${row['Last name']} | ${row['Contact']}`,
                address: `${row['Address']} ${row['Addresse2']} ${row['Zip code']} ${row['City']} ${row['Kommune']} ${row['Land']}`,
                email: email.toLowerCase(),
                tel: norwayPhoneNo(tel),
            }
        }).filter(val => val !== null);

        const userId = '6723c1075170ac0124060952';
        const user = await User.findOne({ _id: userId }).lean();

        for (const customer of solidusCustomers) {
            const checkCustomer = await Customer.findOne({ email: customer.email }).lean();
            if (!checkCustomer) {
                const dbc = await Customer.findOneAndUpdate({ email: customer.email }, {
                    $setOnInsert: {
                        name: customer.name.replace(',', ''),
                        address: customer.address.replace('undefined', ''),
                        tel: customer.tel
                    }
                }, {
                    upsert: true,
                    new: true,
                })

                await saveLog(
                    logTemplates({
                        type: 'customerCreatedFromSolidus',
                        entity: dbc,
                        actor: user,
                    }),
                );
            }
        }
    } catch (error) {
        console.log(error);
    }
}

async function readKontakterSharePoint() {
    try {
        const filePath = path.join(__dirname, 'sharepoint.xlsx');
        console.log(filePath);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.worksheets[0];
        const rows = [];

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            rows.push(row.values.slice(1));
        });

        const headers = rows[0];
        const dataRows = rows.slice(1);
        const jsonData = dataRows.map(row => {
            return headers.reduce((acc, key, idx) => {
                acc[key] = row[idx] ?? '';
                return acc;
            }, {});
        });

        const customers = jsonData.map(row => {
            const email = row['E-mail'];
            const tel = row['Mobil'];
            if (!email) return null;
            const address = (`${row['Adresse']} ${row['Postnummer']} ${row['City']} ${row['District']} ${row['Country']} ${row['Land']}`).replace('undefined', '').trim();
            return {
                name: `${row['Fornavn']} || ${row['LastName']} || ${row['OrganizationName'].replace('undefined', '').trim()}`,
                address,
                email: email.toLowerCase(),
                tel: norwayPhoneNo(tel),
            }
        }).filter(val => val !== null);

        const userId = '6723c1075170ac0124060952';
        const user = await User.findOne({ _id: userId }).lean();

        for (const customer of customers) {
            const checkCustomer = await Customer.findOne({ email: customer.email }).lean();
            if (!checkCustomer) {
                const dbc = await Customer.findOneAndUpdate({ email: customer.email }, {
                    $setOnInsert: {
                        name: customer.name,
                        address: customer.address,
                        tel: customer.tel
                    }
                }, {
                    upsert: true,
                    new: true
                });

                await saveLog(
                    logTemplates({
                        type: 'customerCreatedFromSharePoint',
                        entity: dbc,
                        actor: user,
                    }),
                );
            }

        }
    } catch (error) {
        console.log(error);
    }
}

function formatPakistaniPhone(phone) {
    if (!phone) return 'Not Listed';
    phone = phone.replace(/[^0-9]/g, ''); // remove all non-numeric characters
    if (phone.startsWith('0')) {
        phone = phone.slice(1); // remove starting 0
    }
    return `+92${phone}`;
}

async function fixPakOrphanPhoneNos() {
    const model = await createDynamicModel('pakistan-orphans');
    const entries = await model.find().lean();
    for (const entry of entries) {
        if (entry.guardianPhoneNo1?.startsWith('+') || entry.guardianPhoneNo2?.startsWith('+')) continue;
        const phone1 = formatPakistaniPhone(entry.guardianPhoneNo1);
        const phone2 = formatPakistaniPhone(entry.guardianPhoneNo2);
        await model.updateOne({ _id: entry._id }, {
            $set: {
                guardianPhoneNo1: phone1,
                guardianPhoneNo2: phone2,
            }
        });
    }

}

function scheduleDailyTask(taskFn, hour = 5, minute = 0) {
    const now = new Date();
    const nextRun = new Date();

    nextRun.setHours(hour, minute, 0, 0);

    if (nextRun <= now) {
        // If time already passed today, schedule for tomorrow
        nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun - now;

    console.log(`Scheduled task will run after ${(delay / 60 / 60 / 1000).toFixed(2)} hours`);

    setTimeout(() => {
        taskFn(); // First run at 5 AM
        setInterval(taskFn, 24 * 60 * 60 * 1000); // Then every 24 hours
    }, delay);
}

const sendGazaEmail = async (data) => {
    const fss = require('fs').promises;
    let transporter = nodemailer.createTransport(emailConfig);

    const templatePath = path.join(__dirname, '../views/emails/gazaUpdate27June2025.handlebars');
    const templateSource = await fss.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const { portalUrl, newUser } = await getPortalUrl(data.customer);

    const to = process.env.ENV === 'test' ? 'qasimali24@gmail.com' : data.customer.email;

    const mailOptions = {
        from: `"Alkhidmat Europe" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Update on Your Sponsored Beneficiary in Gaza',
        html: compiledTemplate({
            name: data.customer.name,
            orders: data.orders,
            entries: data.entries,
            tooManyEntries: data.entries.length > 15 ? true : false,
            pluralEntries: data.entries.length > 1 ? true : false,
            portalUrl,
            newUser,
        }),
    };

    await transporter.sendMail(mailOptions);

}

async function sendGazaUpdate() {
    try {
        const orders = await Order.find({
            'projects.slug': 'gaza-orphans',
            status: 'paid',
            customerId: {
                $nin: [
                    new mongoose.Types.ObjectId('68496e48dbce9ead4cd7fc53'),
                    new mongoose.Types.ObjectId('67dd7d90d39f5002372bba2a')
                ]
            }
        }).sort({ createdAt: 1 }).lean();

        const customerIds = new Set(orders.map(order => order.customerId.toString()));
        const customers = [];
        const model = await createDynamicModel('gaza-orphans');

        const userId = '6723c1075170ac0124060952';
        const user = await User.findOne({ _id: userId }).lean();

        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        for (const customerId of customerIds) {
            const customer = await Customer.findById(customerId).lean();
            const customerOrders = orders.filter(order => order.customerId.toString() === customer._id.toString());
            const entries = [];
            for (const order of customerOrders) {
                for (const project of order.projects) {
                    if (project.slug !== 'gaza-orphans') continue;
                    for (const projectEntry of project.entries) {
                        const entry = await model.findById(projectEntry.entryId).lean();
                        entry.age = getAgeInYearsAndMonths(entry.dateOfBirth);
                        entries.push(entry);
                    }
                }
            }
            const data = {
                customer,
                orders: customerOrders,
                entries: entries
            };


            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const recentLogs = await Log.find({
                entityId: customer._id,
                timestamp: { $gt: twentyFourHoursAgo },
                action: /Gaza update/i
            }).lean();

            if (recentLogs.length > 0) {
                console.log(`Don’t send a message to ${customer.name}`);
            } else {
                await delay(1000);
                console.log(customer.name);
                console.log(`Sending email to ${customer.name}`);
                await sendGazaEmail(data);
                await saveLog(
                    logTemplates({
                        type: 'customerEmailUpdated',
                        message: `Gaza Update for <a href="/customer/${customer._id}">${customer.name}</a><br> <i>Due to ongoing conflict and telecom disruptions in Gaza, report delivery may be delayed. Our team is working on ground to resolve the pending reports as soon as possible. Jazakum Allahu Khairan for your patience and support.</i>`,
                        entity: customer,
                        actor: user,
                    }),
                );
                console.log(`Email sent to ${customer.name}`);
            }
        }
    } catch (error) {
        console.log(error);
        sendErrorToTelegram(error.message || 'Script error. please check logs.');
    }

}

async function gazaOrphanSelectionTimeLine() {
    const model = await createDynamicModel('gaza-orphans');
    const orders = await Order.find({
        $and: [
            {
                customerId: {
                    $nin: [
                        new mongoose.Types.ObjectId('68496e48dbce9ead4cd7fc53'),
                        new mongoose.Types.ObjectId('67dd7d90d39f5002372bba2a')
                    ]
                }
            },
            {
                $or: [
                    { status: 'paid' },
                    { status: 'expired' }
                ]
            }
        ]
    })
        .sort({ createdAt: 1 })
        .lean();

    const entries = [];

    for (const order of orders) {
        const customer = await Customer.findById(order.customerId).lean();
        const type = await getOrderType(order._id);
        const project = order.projects.find(prj => prj.slug === 'gaza-orphans');
        if (!project) continue;
        for (const orderEntry of project.entries) {
            const entryId = orderEntry.entryId;
            const doc = await model.findOne({ _id: entryId }).lean();
            entries.push({
                createdAt: formatDate(order.createdAt),
                orderNo: order.orderNo,
                donor: customer.name,
                type: type.type,
                status: order.status,
                payments: type.payments.length,
                beneficiary: doc.name,
                cluster: doc.cluster,
            });
        }
    }

    const sortedEntries = entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    exportToCSV(sortedEntries, `gaza-timeline-${formatDate(Date.now())}.csv`);

};

mongoose.connection.on('open', async () => {
    await deleteDraftOrders(Order);
    await deleteDraftOrders(Subscription);
    await convertUnpaidToExpired(Order);
    // await Customer.deleteMany({email: /[A-Z]/  });
    // await readKontakterSharePoint();
    // await readKontakterSolidus();
    // await handleGazaBeneficiaries();
    // await handleEgyptFamilyUsers();
    // await handleGazaOrphanForm();
    // await formatGazaPhoneNos();
    // await remove600Children();
    // await resetGazaOrphanPricesTo600();
    // await sendWhatsappMessageWithFormLink();
    // await calculateRevenueFromOrders();
    // await calculateRevenueFromDonor();
    // await createDirectDonorLongUpdatesSheet();
    // await sendGazaUpdate();
    // await gazaOrphanSelectionTimeLine();

    setInterval(async () => {
        try {
            await deleteDraftOrders(Order);
            await deleteDraftOrders(Subscription);
        } catch (error) {
            console.error('Error deleting expired orders:', error);
        }
    }, 60 * 1000);

    scheduleDailyTask(async () => {
        try {
            await createDirectDonorGazaUpdate();
            await createDirectDonorPakistanStudentUpdate();
            await convertUnpaidToExpired(Order);
        } catch (error) {
            console.error('Error running scheduled donor updates:', error);
        }
    }, 1, 0);
});

module.exports = {
    connectDB
};
