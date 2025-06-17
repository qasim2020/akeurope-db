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
const { formatDate } = require('../modules/helpers');
const { getCurrencyRates } = require('../modules/getCurrencyRates');
const { logTemplates } = require('../modules/logTemplates');

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
;

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
            if (payment.agreementId) {
                amount = payment.amount / 100;
                method = 'vipps subscription';
                query = { _id: payment.externalId };
            } else if (payment.price) {
                amount = payment.price / 100;
                method = 'stripe subscription';
                query = { _id: payment.orderId };
            } else if (payment.paymentMethod) {
                amount = payment.amount.value / 100;
                method = 'vipps one-time';
                query = { vippsReference: payment.reference };
            } else {
                amount = payment.amount;
                method = 'stripe one-time';
                query = { _id: payment.orderId };
            }

            const order = (await Order.findOne(query).lean()) || (await Subscription.findOne(query).lean());

            if (!order) {
                console.log(payment);
                continue;
            };

            if (rateCache.has(currency)) {
                currencyRate = rateCache.get(currency);
            } else {
                const currencyRates = await getCurrencyRates(currency);
                currencyRate = parseFloat(currencyRates.rates.get('NOK').toFixed(2));
                rateCache.set(currency, currencyRate);
            }

            array.push({
                date: order.createdAt,
                orderNo: Number(order.orderNo),
                email: donor.email,
                method,
                originalPaid: `${amount} ${currency}`,
                convertedNOK: `${(amount * currencyRate).toFixed(2)}`,
            });

            revenue += amount * currencyRate;
        };

    }

    console.log(revenue, 'revenue calculated');
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
    // Remove any spaces, dashes, parentheses but keep leading +
    phone = phone.replace(/[^\d+]/g, '');

    // If starts with +, assume fully formatted international, return as is
    if (phone.startsWith('+')) return phone;

    // Remove a single leading zero if present
    if (phone.startsWith('0')) phone = phone.slice(1);

    const len = phone.length;

    // If 8 or 12 digits, it's a Norwegian number
    if (len === 8 || len === 12) {
        return `+47${phone}`;
    }

    // Otherwise, return clean number—may be invalid
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
                email,
                tel: norwayPhoneNo(tel),
            }
        }).filter(val => val !== null);

        const userId = '6723c1075170ac0124060952';
        const user = await User.findOne({ _id: userId }).lean();

        for (const customer of solidusCustomers) {
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
                email,
                tel: norwayPhoneNo(tel),
            }
        }).filter(val => val !== null);

        const userId = '6723c1075170ac0124060952';
        const user = await User.findOne({ _id: userId }).lean();

        for (const customer of customers) {
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
    } catch (error) {
        console.log(error);
    }
}

mongoose.connection.on('open', async () => {
    await deleteDraftOrders(Order);
    await deleteDraftOrders(Subscription);
    await convertUnpaidToExpired(Order);
    await readKontakterSharePoint();
    await readKontakterSolidus();
    // await handleGazaBeneficiaries();
    // await handleEgyptFamilyUsers();
    // await handleGazaOrphanForm();
    // await formatGazaPhoneNos();
    // await remove600Children();
    // await resetGazaOrphanPricesTo600();
    // await sendWhatsappMessageWithFormLink();
    // await calculateRevenueFromOrders();
    // await calculateRevenueFromDonor();

    setInterval(async () => {
        try {
            await deleteDraftOrders(Order);
            await deleteDraftOrders(Subscription);
            await convertUnpaidToExpired(Order);
        } catch (error) {
            console.error('Error deleting expired orders:', error);
        }
    }, 60 * 1000);

    setInterval(async () => {
        try {
            // await handleEgyptFamilyUsers();
        } catch (error) {
            console.error('Error deleting expired orders:', error);
        }
    }, 60 * 60 * 1000);
});

module.exports = connectDB;
