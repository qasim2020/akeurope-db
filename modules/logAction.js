const { createDynamicModel } = require('../models/createDynamicModel');
const Project = require('../models/Project');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Beneficiary = require('../models/Beneficiary');
const Log = require('../models/Log');
const User = require('../models/User');
const { generatePagination } = require('../modules/generatePagination');

const saveLog = async ({
    entityType,
    entityId,
    actorType,
    actorId,
    action,
    changes,
    url,
    color,
    isNotification,
    isRead,
    isReadByCustomer,
    expiresAt,
}) => {
    try {
        const log = new Log({
            entityType,
            entityId,
            actorType,
            actorId,
            timestamp: new Date(),
            action,
            changes,
            url,
            isNotification,
            isRead,
            isReadByCustomer,
            expiresAt,
            color,
        });

        await log.save();
    } catch (error) {
        console.error('Error creating log:', error);
        return error;
    }
};

const updateLog = async ({ logId, updates }) => {
    const updatedLog = await Log.findByIdAndUpdate(logId, { $set: updates }, { new: true });

    if (!updatedLog) {
        throw new Error('Log not found or update failed.');
    }

    return updatedLog;
};

const beneficiaryLogs = async (req, res) => {
    try {

        let entityIds = [];
        const beneficiary = await Beneficiary.findById(req.params.beneficiaryId).lean();

        for (const slug of beneficiary.projects) {
            let entriesFound = [];
            const model = await createDynamicModel(slug);
            const project = await Project.findOne({ slug }).lean();
            if (slug === 'egypt-family') {
                entriesFound = await model.find({ 'uploadedBy.actorId': beneficiary._id.toString() }).lean();
            } else {
                const phoneFields = project.fields.filter(field => field.phone === true);
                const queryOr = phoneFields.map(field => ({
                    [field.name]: beneficiary.phoneNumber
                }));
                entriesFound = await model.find({
                    $or: queryOr
                }).lean();
            }
            entityIds.push(entriesFound.map(entry => entry._id.toString()));
            console.log(entityIds);
        };

        let query = {
            entityId: { $in: entityIds },
            entityType: { $ne: 'order' },
        };

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const total = await Log.countDocuments(query);

        const logs = await Log.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ timestamp: -1 })
            .lean();

        const totalPages = Math.ceil(total / limit);

        return {
            logs: await findConnectedIds(logs, req),
            pagesArray: generatePagination(totalPages, page),
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};

const entryLogs = async (req, res) => {
    try {
        let query;

        if (req.userPermissions.includes('viewOrders')) {
            query = {
                entityId: req.params.entryId,
                entityType: { $ne: 'order' },
            };
        } else {
            query = {
                entityId: req.params.entryId,
                entityType: { $ne: 'order' },
            };
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const total = await Log.countDocuments(query);

        const logs = await Log.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ timestamp: -1 })
            .lean();

        const totalPages = Math.ceil(total / limit);

        return {
            logs: await findConnectedIds(logs, req),
            pagesArray: generatePagination(totalPages, page),
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};

const userLogs = async (req, userId) => {
    const user = await User.findById(userId).lean();
    const userProjects = user.projects;
    const userEntries = [];
    for (const slug of userProjects) {
        const model = await createDynamicModel(slug);
        const entries = await model.find({}).select('_id').lean();
        userEntries.push(...entries.map(entry => entry._id.toString()));
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.showBy || 'project';
    let query;

    if (filter === 'actor') {
        query = {
            actorId: userId,
        };
    } else if (filter === 'entity') {
        query = {
            entityId: userId,
            actorId: { $ne: userId },
        };
    } else if (filter === 'project') {
        query = {
            entityId: { $in: userEntries }
        };
    } else {
        query = {
            $or: [
                {
                    entityId: userId,
                },
                {
                    entityId: userId,
                    actorId: { $ne: userId },
                },
                {
                    entityId: { $in: userEntries }
                }
            ],
        };
    }

    const total = await Log.countDocuments(query);
    const logs = await Log.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ timestamp: -1 })
        .lean();

    const totalPages = Math.ceil(total / limit);

    return {
        showBy: filter,
        logs: await findConnectedIds(logs, req),
        pagesArray: generatePagination(totalPages, page),
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
    };
};

const customerLogs = async (req, res) => {
    try {
        const orders = await Order.find({
            customerId: req.params.customerId,
        }).lean();

        const subscriptions = await Subscription.find({
            customerId: req.params.customerId,
        }).lean();

        const query = {
            $or: [
                { entityId: req.params.customerId },
                { entityId: { $in: orders.map((order) => order._id) } },
                { entityId: { $in: subscriptions.map((order) => order._id) } },
            ],
        };

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const total = await Log.countDocuments(query);

        const logs = await Log.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ timestamp: -1 })
            .lean();

        const totalPages = Math.ceil(total / limit);

        return {
            logs: await findConnectedIds(logs, req),
            pagesArray: generatePagination(totalPages, page),
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};

const orderLogs = async (req, res) => {
    try {
        const query = { entityId: req.params.orderId };

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const total = await Log.countDocuments(query);

        const logs = await Log.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ timestamp: -1 })
            .lean();

        const totalPages = Math.ceil(total / limit);

        return {
            logs: await findConnectedIds(logs, req),
            pagesArray: generatePagination(totalPages, page),
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};

const findConnectedIds = async (logs, req) => {
    for (const log of logs) {
        if (log.entityType == 'user') {
            log.entity = await User.findById(log.entityId).lean();
        } else if (log.entityType == 'customer') {
            log.entity = await Customer.findById(log.entityId).lean();
        }
        if (log.actorType == 'customer') {
            log.actor = await Customer.findById(log.actorId).lean();
        } else if (log.actorType == 'user') {
            log.actor = await User.findById(log.actorId).lean();
            const testOne = log.actor && log.actor._id.toString();
            const testTwo = req && req.session.user._id.toString();
            log.actorIsSelf = testOne === testTwo;
        } else if (log.actorType == 'beneficiary') {
            log.actor = await Beneficiary.findById(log.actorId).lean();
            console.log(log.actor);
        };
        log.viewer = req && req.session.user;
    }

    return logs;
};

const visibleLogs = async (req, res) => {
    try {
        const logs = await Log.find({ isNotification: true, isRead: false }).sort({ timestamp: -1 }).lean();
        return await findConnectedIds(logs);
    } catch (error) {
        console.log(error);
        return error;
    }
};

const activtyByEntityType = async (req, res) => {
    try {
        const entityType = req.query.entityType || undefined;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const query = entityType ? { entityType } : {};
        const total = await Log.countDocuments(query);
        const logs = await Log.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ timestamp: -1 })
            .lean();

        const totalPages = Math.ceil(total / limit);

        return {
            logs: await findConnectedIds(logs, req),
            entityTypes: await Log.distinct('entityType').lean(),
            entityType,
            pagesArray: generatePagination(totalPages, page),
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};

module.exports = {
    saveLog,
    updateLog,
    visibleLogs,
    entryLogs,
    userLogs,
    customerLogs,
    orderLogs,
    activtyByEntityType,
    beneficiaryLogs,
};
