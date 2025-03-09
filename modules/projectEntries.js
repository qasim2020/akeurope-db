const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

const { createDynamicModel } = require('../models/createDynamicModel');
const { generatePagination } = require('../modules/generatePagination');
const { generateSearchQuery } = require('../modules/generateSearchQuery');

const fetchEntrySubscriptionsAndPayments = async function (entry) {
    if (!entry) {
        return null;
    }

    const entryId = entry._id;

    const payments = await Payment.find({ entryId }).sort({ date: -1 }).lean();

    const subscription = await Subscription.find({ entryId }).lean();

    entry.payments = payments || null;
    entry.subscriptions = subscription || null;
    return entry;
};

const fetchEntryDetailsFromPaymentsAndSubscriptions = async function (entries) {
    const entryIds = entries.map((entry) => entry._id);
    const lastPayments = await Payment.aggregate([
        { $match: { entryId: { $in: entryIds } } },
        { $sort: { date: -1 } },
        {
            $group: {
                _id: '$entryId',
                lastPaid: { $first: '$date' },
            },
        },
    ]);

    const subscriptions = await Subscription.find({
        entryId: { $in: entryIds },
    }).lean();

    const lastPaymentsMap = Object.fromEntries(lastPayments.map(({ _id, lastPaid }) => [_id.toString(), lastPaid]));

    const subscriptionsMap = Object.fromEntries(subscriptions.map((sub) => [sub.entryId.toString(), sub]));

    entries.forEach((entry) => {
        entry.lastPaid = lastPaymentsMap[entry._id.toString()] || null;
        entry.subscriptions = subscriptionsMap[entry._id.toString()] || null;
    });

    return entries;
};

const projectEntries = async function (req, res) {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    const DynamicModel = await createDynamicModel(project.slug);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortBy = req.query.sortBy || '_id';
    const order = req.query.orderBy === 'desc' ? 1 : -1;
    const sortOptions = { [sortBy]: order };

    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);

    const serializedFilters = Object.fromEntries(
        Object.entries(fieldFilters).map(([key, value]) => [key, JSON.stringify(value)]),
    );

    const filtersQuery = new URLSearchParams(serializedFilters).toString();

    let entries = [];
    let totalEntries, totalPages;

    entries = await DynamicModel.aggregate([
        { $match: searchQuery },
        {
            $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "projects.entries.entryId",
                as: "orderInfo"
            }
        },
        { $unwind: { path: "$orderInfo", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$orderInfo.projects", preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                isPaid: {
                    $cond: {
                        if: {
                            $and: [
                                { $eq: ["$orderInfo.status", "paid"] },
                                {
                                    $gt: [
                                        {
                                            $add: [
                                                "$orderInfo.createdAt",
                                                {
                                                    $multiply: [
                                                        "$orderInfo.projects.months",
                                                        30 * 24 * 60 * 60 * 1000
                                                    ]
                                                }
                                            ]
                                        },
                                        new Date()
                                    ]
                                }
                            ]
                        },
                        then: 1,
                        else: 0
                    }
                }
            }
        },
        ...(req.query.sortBy === "paid"
            ? [{ $sort: { isPaid: -1, ...sortOptions } }]
            : [{ $sort: { ...sortOptions }}]),
        { $skip: skip },
        { $limit: limit }
    ]);
    
    totalEntries = await DynamicModel.countDocuments(searchQuery);
    
    totalEntries = await DynamicModel.countDocuments(searchQuery);
    totalPages = Math.ceil(totalEntries / limit);

    return {
        entries,
        project,
        pagination: {
            totalEntries,
            totalPages,
            currentPage: page,
            limit,
            startIndex: totalEntries == 0 ? 0 : skip + 1,
            endIndex: Math.min(skip + limit, totalEntries),
            pagesArray: generatePagination(totalPages, page),
            sort: {
                sortBy,
                order: req.query.orderBy == undefined ? 'asc' : req.query.orderBy,
            },
            search: req.query.search,
            filtersQuery,
            fieldFilters: fieldFilters == {} ? undefined : fieldFilters,
            showSearchBar: req.query.showSearchBar,
            showFilters: req.query.showFilters,
        },
    };
};

const getPaidOrdersByEntryId = async (req, res) => {
    const orders = await Order.find({
        status: 'paid',
        'projects.entries': {
            $elemMatch: {
                entryId: req.params.entryId,
                totalCost: { $ne: 0 },
            },
        },
    }).lean();

    for (const order of orders) {
        order.customer = await Customer.findById(order.customerId).lean();
        const project = order.projects.find((project) => project.entries.find((entry) => entry.entryId == req.params.entryId));
        order.project = project;
        order.entry = project.entries.find((entry) => entry.entryId == req.params.entryId);
    }

    return orders;
};

const getAllOrdersByEntryId = async (req, res) => {
    const orders = await Order.find({
        'projects.entries': {
            $elemMatch: {
                entryId: req.params.entryId,
                totalCost: { $ne: 0 },
            },
        },
    }).lean();

    for (const order of orders) {
        order.customer = await Customer.findById(order.customerId).lean();
        const project = order.projects.find((project) => project.entries.find((entry) => entry.entryId == req.params.entryId));
        order.project = project;
        order.entry = project.entries.find((entry) => entry.entryId == req.params.entryId);
    }

    return orders;
};

const countPaidEntriesInProject = async (slug) => {
    const result = await Order.aggregate([
        {
            $match: { status: "paid", "projects.slug": slug }
        },
        {
            $addFields: {
                maxMonths: { $max: "$projects.months" },
                orderExpiry: {
                    $add: [
                        "$createdAt",
                        { $multiply: [{ $max: "$projects.months" }, 30 * 24 * 60 * 60 * 1000] }
                    ]
                }
            }
        },
        {
            $match: {
                orderExpiry: { $gt: new Date() }
            }
        },
        {
            $unwind: "$projects"
        },
        {
            $match: { "projects.slug": slug }
        },
        {
            $unwind: "$projects.entries"
        },
        {
            $count: "totalPaidEntries"
        }
    ]);

    return result.length > 0 ? result[0].totalPaidEntries : 0;
};

module.exports = {
    projectEntries,
    fetchEntrySubscriptionsAndPayments,
    getPaidOrdersByEntryId,
    getAllOrdersByEntryId,
    countPaidEntriesInProject,
};
