const { generateSearchQuery } = require('../modules/generateSearchQuery');
const { createDynamicModel } = require('../models/createDynamicModel');

const Order = require('../models/Order');
const mongoose = require('mongoose');
const { errorMonitor } = require('connect-mongo');

const validateQuery = async (req, res) => {
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const order = await Order.findById(req.query.orderId).lean();
    const projectInOrder = order.projects.find(
        (project) => project.slug === projectSlug,
    );
    if (!projectInOrder) {
        return true;
    }
    if (
        req.query.subscriptions &&
        req.query.subscriptions != 'empty' &&
        !req.query.entryId
    ) {
        const subscriptions = req.query.subscriptions.split(',');
        let excludedEntries = [];
        for (const entry of projectInOrder.entries) {
            const orders = await Order.aggregate([
                { $unwind: '$projects' },
                { $unwind: '$projects.entries' },
                {
                    $match: {
                        _id: { $ne: order._id },
                        'projects.entries.entryId': entry.entryId,
                        'projects.entries.totalCost': { $gt: 0 },
                        status: 'paid',
                    },
                },
                {
                    $addFields: {
                        projectExpiry: {
                            $add: [
                                '$createdAt',
                                {
                                    $multiply: [
                                        '$projects.months',
                                        30 * 24 * 60 * 60 * 1000,
                                    ],
                                },
                                30 * 24 * 60 * 60 * 1000,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        orderId: '$_id',
                        entryId: '$projects.entries.entryId',
                        lastPaid: '$createdAt',
                        selectedSubscriptions:
                            '$projects.entries.selectedSubscriptions',
                        costs: '$projects.entries.costs',
                        orderNo: '$orderNo',
                        expiry: '$projectExpiry',
                    },
                },
                { $sort: { lastPaid: 1 } },
            ]);

            if (orders.length > 0) {
                const validSubscriptions = subscriptions.filter(
                    (subscription) => {
                        return !orders.some(
                            (order) =>
                                order.selectedSubscriptions.includes(
                                    subscription,
                                ) && new Date(order.expiry) > new Date(),
                        );
                    },
                );

                excludedEntries.push({
                    entryId: entry.entryId,
                    validSubscriptions: validSubscriptions,
                });
            }
        }

        req.query.excludedEntries = excludedEntries;
    }

    if (
        req.query.subscriptions &&
        req.query.subscriptions != 'empty' &&
        req.query.entryId
    ) {
        const subscriptions = req.query.subscriptions.split(',');
        const entryId = new mongoose.Types.ObjectId(req.query.entryId);

        const orders = await Order.aggregate([
            { $unwind: '$projects' },
            { $unwind: '$projects.entries' },
            {
                $match: {
                    _id: { $ne: order._id },
                    'projects.entries.entryId': entryId,
                    'projects.entries.totalCost': { $gt: 0 },
                    status: 'paid',
                },
            },
            {
                $addFields: {
                    projectExpiry: {
                        $add: [
                            '$createdAt',
                            {
                                $multiply: [
                                    '$projects.months',
                                    30 * 24 * 60 * 60 * 1000,
                                ],
                            },
                            30 * 24 * 60 * 60 * 1000,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: '$projects.entries.entryId',
                    lastPaid: { $first: '$createdAt' },
                    selectedSubscriptions: {
                        $first: '$projects.entries.selectedSubscriptions',
                    },
                    orderId: { $first: '$_id' },
                    expiry: { $first: '$projectExpiry' },
                },
            },
            { $sort: { lastPaid: 1 } },
        ]);
        if (orders.length > 0) {
            for (const order of orders) {
                const isAlreadyOrdered = subscriptions.some((subscription) => {
                    return (
                        order.selectedSubscriptions.includes(subscription) &&
                        new Date(order.expiry) > new Date()
                    );
                });
                if (isAlreadyOrdered)
                    throw new Error(
                        `Couldn't select ${entryId} for subscription as it is already subscribed!`,
                    );
            }
        }
    }

    return true;
};

const getPreviousOrdersForEntry = async (entryId, orderId) => {
    if (!orderId) {
        throw new Error('order id is required');
    }
    const lastPaidOrders = await Order.aggregate([
        { $unwind: '$projects' },
        { $unwind: '$projects.entries' },
        {
            $match: {
                _id: { $ne: orderId },
                'projects.entries.entryId': entryId,
                'projects.entries.totalCost': { $gt: 0 },
                status: 'paid',
            },
        },
        {
            $addFields: {
                projectExpiry: {
                    $add: [
                        '$createdAt',
                        {
                            $multiply: [
                                '$projects.months',
                                30 * 24 * 60 * 60 * 1000,
                            ],
                        },
                        30 * 24 * 60 * 60 * 1000,
                    ],
                },
            },
        },
        {
            $project: {
                _id: 1,
                orderId: '$_id',
                entryId: '$projects.entries.entryId',
                lastPaid: '$createdAt',
                selectedSubscriptions:
                    '$projects.entries.selectedSubscriptions',
                costs: '$projects.entries.costs',
                orderNo: '$orderNo',
                expiry: '$projectExpiry',
            },
        },
        { $sort: { lastPaid: 1 } },
    ]);

    const lastPaid = lastPaidOrders.length > 0 ? lastPaidOrders : null;

    return lastPaid;
};

const getOldestPaidEntries = async (req, project) => {
    const DynamicModel = await createDynamicModel(project.slug);
    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);
    const selectCount = parseInt(req.query.select) || 50;

    const lastIncompleteOrders = await Order.aggregate([
        { $unwind: '$projects' },
        { $unwind: '$projects.entries' },
        {
            $match: {
                status: 'paid',
                'projects.entries.totalCost': { $gt: 0 },
                'projects.entries.costs': {
                    $elemMatch: {
                        totalCost: { $gt: 0 },
                        totalOrderedCost: 0,
                    },
                },
            },
        },
        {
            $addFields: {
                projectExpiry: {
                    $add: [
                        '$createdAt',
                        {
                            $multiply: [
                                '$projects.months',
                                30 * 24 * 60 * 60 * 1000,
                            ],
                        },
                        30 * 24 * 60 * 60 * 1000,
                    ],
                },
            },
        },
        {
            $project: {
                _id: 1,
                orderId: '$_id',
                entryId: '$projects.entries.entryId',
                lastPaid: '$createdAt',
                selectedSubscriptions:
                    '$projects.entries.selectedSubscriptions',
                costs: '$projects.entries.costs',
                expiry: '$projectExpiry',
            },
        },
        { $sort: { lastPaid: 1 } },
    ]);

    const lastOrders = await Order.aggregate([
        { $unwind: '$projects' },
        { $unwind: '$projects.entries' },
        {
            $match: {
                'projects.entries.totalCost': { $gt: 0 },
                'projects.entries.costs': {
                    $not: {
                        $elemMatch: {
                            totalCost: { $gt: 0 },
                            totalOrderedCost: 0,
                        },
                    },
                },
                status: 'paid',
            },
        },
        {
            $addFields: {
                projectExpiry: {
                    $add: [
                        '$createdAt',
                        {
                            $multiply: [
                                '$projects.months',
                                30 * 24 * 60 * 60 * 1000,
                            ],
                        },
                        30 * 24 * 60 * 60 * 1000,
                    ],
                },
            },
        },
        {
            $group: {
                _id: '$projects.entries.entryId',
                lastPaid: { $first: '$createdAt' },
                selectedSubscriptions: {
                    $first: '$projects.entries.selectedSubscriptions',
                },
                costs: {
                    $first: '$projects.entries.costs',
                },
                orderId: { $first: '$_id' },
                expiry: { $first: '$projectExpiry' },
            },
        },
        { $sort: { lastPaid: 1 } },
    ]);

    let paidEntryIds = lastOrders.map((order) => order._id);
    let halfPaidEntryIds = lastIncompleteOrders.map((order) => order.entryId);

    const countNotPaid = await DynamicModel.countDocuments({
        _id: { $nin: [...paidEntryIds, ...halfPaidEntryIds] },
        ...searchQuery,
    });

    const countHalfPaid = await DynamicModel.countDocuments({
        _id: { $in: halfPaidEntryIds },
        ...searchQuery,
    });

    let entriesToPay = [];
    if (countNotPaid > selectCount) {
        entriesToPay = await DynamicModel.find({
            _id: { $nin: [...paidEntryIds, ...halfPaidEntryIds] },
            ...searchQuery,
        })
            .limit(selectCount)
            .lean();
    }

    if (countNotPaid <= selectCount) {
        let entriesWithPayments = [];
        let entriesWithHalfPayments = [];
        let entriesWithOutPayments = [];
        const pickFromNotPaid = countNotPaid;
        const pickFromHalfPaid =
            selectCount - countNotPaid >= countHalfPaid
                ? countHalfPaid
                : selectCount - countNotPaid;
        const pickFromPaid = selectCount - (pickFromNotPaid + pickFromHalfPaid);
        if (pickFromNotPaid > 0) {
            entriesWithOutPayments = await DynamicModel.find({
                _id: { $nin: [...paidEntryIds, ...halfPaidEntryIds] },
                ...searchQuery,
            })
                .limit(pickFromNotPaid)
                .lean();
        }
        if (pickFromHalfPaid > 0) {
            halfPaidEntryIds = halfPaidEntryIds.slice(0, pickFromHalfPaid);
            entriesWithHalfPayments = await DynamicModel.find({
                _id: { $in: halfPaidEntryIds },
                ...searchQuery,
            })
                .limit(pickFromHalfPaid)
                .lean();
            for (const entry of entriesWithHalfPayments) {
                entry.oldOrders =
                    lastIncompleteOrders.filter(
                        (order) =>
                            order.entryId.toString() === entry._id.toString(),
                    ) || null;
            }
        }
        if (pickFromPaid > 0) {
            paidEntryIds = paidEntryIds.slice(0, pickFromPaid);
            entriesWithPayments = await DynamicModel.find({
                _id: { $in: paidEntryIds },
                ...searchQuery,
            })
                .limit(pickFromPaid)
                .lean();
            for (const entry of entriesWithPayments) {
                entry.oldOrders =
                    lastOrders.filter(
                        (order) =>
                            order._id.toString() === entry._id.toString(),
                    ) || null;
            }
        }
        entriesToPay = [
            ...entriesWithOutPayments,
            ...entriesWithHalfPayments,
            ...entriesWithPayments,
        ];
    }

    return {
        project,
        allEntries: entriesToPay,
    };
};

const makeProjectForOrder = (project, allEntries) => {
    return {
        slug: project.slug,
        months: 12,
        entries: allEntries.map((entry) => {
            return {
                entryId: entry._id,
                selectedSubscriptions: project.fields
                    .filter((field) => {
                        const isSubscriptionValid =
                            field.subscription &&
                            entry[field.name] !== undefined;

                        if (!entry.oldOrders) {
                            return isSubscriptionValid;
                        }

                        const isAlreadyOrdered = entry.oldOrders.some(
                            (order) => {
                                return (
                                    order.selectedSubscriptions &&
                                    order.selectedSubscriptions.includes(
                                        field.name,
                                    ) &&
                                    new Date(order.expiry) > new Date()
                                );
                            },
                        );

                        return isSubscriptionValid && isAlreadyOrdered == false;
                    })
                    .map((field) => field.name),
            };
        }),
    };
};

module.exports = {
    getOldestPaidEntries,
    makeProjectForOrder,
    getPreviousOrdersForEntry,
    validateQuery,
};
