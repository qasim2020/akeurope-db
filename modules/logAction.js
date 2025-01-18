const { createDynamicModel } = require('../models/createDynamicModel');
const Project = require('../models/Project');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
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
    timestamp = new Date(),
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
            action,
            changes,
            timestamp,
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
    const updatedLog = await Log.findByIdAndUpdate(
        logId,
        { $set: updates },
        { new: true },
    );

    if (!updatedLog) {
        throw new Error('Log not found or update failed.');
    }

    return updatedLog;
};

const entryLogs = async (req, res) => {
    try {
        
        let query;

        if (req.userPermissions.includes('viewOrders')) {
            query = { entityId: req.params.entryId };
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    let query;
    if (req.query.showBy == 'actor') {
        query = {
            actorId: userId,
        };
    } else if (req.query.showBy == 'entity') {
        query = {
            entityId: userId,
        };
    } else {
        query = {
            $or: [
                {
                    entityId: userId,
                },
                {
                    actorId: userId,
                },
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
        showBy: req.query.showBy || 'all',
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

        const query = {
            $or: [
                { entityId: req.params.customerId },
                { entityId: { $in: orders.map((order) => order._id) } },
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
            logs: await findConnectedIds(logs),
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
            logs: await findConnectedIds(logs),
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
            const testOne = log.actor._id.toString();
            const testTwo = req && req.session.user._id.toString();
            log.actorIsSelf = testOne === testTwo;
            log.self = req && req.session.user;
        }
    }

    return logs;
};

const visibleLogs = async (req, res) => {
    try {
        const logs = await Log.find({ isNotification: true, isRead: false })
            .sort({ timestamp: -1 })
            .lean();
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
            logs: await findConnectedIds(logs),
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
};
