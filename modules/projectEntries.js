const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Country = require('../models/Country');
const Log = require('../models/Log');

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
        Object.entries(fieldFilters).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
    );

    const filtersQuery = new URLSearchParams(serializedFilters).toString();

    let entries = [];
    let totalEntries, totalPages;

    if (req.query.sortBy === 'paid') {
        delete sortOptions.paid;
        const orders = await Order.find({
            status: 'paid',
            'projects.slug': project.slug,
        }).sort({ createdAt: -1 }).lean();

        const allPaidEntryIds = orders.flatMap(order =>
            order.projects
                .filter(project => project.slug === req.params.slug)
                .flatMap(project => project.entries.map(entry => entry.entryId))
        );

        const paidCount = await DynamicModel.countDocuments({
            _id: { $in: allPaidEntryIds },
            ...searchQuery,
        });

        if (skip < paidCount) {
            const paidLimit = Math.min(limit, paidCount - skip);

            const paidEntriesWithQuery = await DynamicModel.find({
                _id: { $in: allPaidEntryIds },
                ...searchQuery,
            })
                .sort(sortOptions)
                .lean();

            const entryMap = new Map(
                paidEntriesWithQuery.map(entry => [entry._id.toString(), entry])
            );

            const orderedEntries = [];
            for (const id of allPaidEntryIds) {
                const entry = entryMap.get(id.toString());
                if (entry) {
                    orderedEntries.push(entry);
                }
            }

            const paginatedEntries = orderedEntries.slice(skip, skip + paidLimit);

            entries.push(...paginatedEntries);

            const remainingLimit = limit - paidCount.length;

            if (remainingLimit > 0) {
                const unPaidEntries = await DynamicModel.find({
                    _id: { $nin: allPaidEntryIds },
                    ...searchQuery,
                })
                    .sort(sortOptions)
                    .limit(remainingLimit)
                    .lean();

                entries.push(...unPaidEntries);
            }
        } else {

            const unpaidSkip = skip - paidCount;

            const unPaidEntries = await DynamicModel.find({
                _id: { $nin: allPaidEntryIds },
                ...searchQuery,
            })
                .sort(sortOptions)
                .skip(unpaidSkip)
                .limit(limit)
                .lean();

            entries = unPaidEntries;
        }

    } else {
        entries = await DynamicModel.find(searchQuery).sort(sortOptions).skip(skip).limit(limit).lean();
    }

    for (const entry of entries) {
        const lastLog = await Log.findOne({ entityId: entry._id, entityType: 'entry' }).sort({ timestamp: -1 }).lean();
        entry.lastLog = lastLog?.timestamp;

        const order = await Order.findOne({
            'projects.entries.entryId': entry._id,
            status: 'paid',
        }).lean();

        if (!order) {
            entry.isPaid = 0;
            continue;
        }

        const customer = await Customer.findById(order.customerId).lean();

        let country = null;

        if (customer.address) {
            const address = customer.address;
            const words = address.split(/\s+/).filter((w) => w.length > 2);

            for (const word of words) {
                country = await Country.findOne({
                    name: { $regex: new RegExp(`^${word}$`, 'i') }
                }).lean();
                if (country) break;
            }

            if (!country) {
                country = await Country.findOne({ 'currency.code': order.currency }).lean();
            }
        } else {
            if (customer.tel) {
                const tel = customer.tel?.replace(/\s+/g, '');  // Clean the telephone number
                const prefix = tel.substring(0, 4);
                const regex = `^\\+${prefix}`;

                country = await Country.findOne({
                    callingCodes: {
                        $elemMatch: { $regex: regex, $options: 'i' }
                    }
                }).lean();

                if (!country) {
                    console.log('No country found for this telephone number - falling back to order.currency');
                    country = await Country.findOne({ 'currency.code': order.currency }).lean();
                };

            } else {
                country = await Country.findOne({ 'currency.code': order.currency }).lean();
            }
        }

        entry.orderInfo = order;
        entry.customer = customer;
        entry.country = country;
        entry.isPaid = 1;
    }

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

const getPaidOrdersByEntryId = async (req, res, entryId) => {
    entryId = entryId || req.params.entryId;

    const now = new Date();

    const orders = await Order.find({
        status: 'paid',
        $expr: {
            $gte: [
                {
                    $add: ['$createdAt', { $multiply: [{ $arrayElemAt: ['$projects.months', 0] }, 30 * 24 * 60 * 60 * 1000] }],
                },
                now,
            ],
        },
        'projects.entries': {
            $elemMatch: {
                entryId: entryId,
                totalCost: { $ne: 0 },
            },
        },
    }).lean();

    for (const order of orders) {
        order.customer = await Customer.findById(order.customerId).lean();
        const project = order.projects.find((project) => {
            return project.entries.find((entry) => entry.entryId == entryId.toString());
        });
        order.project = project;
        order.entry = project.entries.find((entry) => entry.entryId == entryId.toString());
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
            $match: { status: 'paid', 'projects.slug': slug },
        },
        {
            $addFields: {
                maxMonths: { $max: '$projects.months' },
                orderExpiry: {
                    $add: ['$createdAt', { $multiply: [{ $max: '$projects.months' }, 30 * 24 * 60 * 60 * 1000] }],
                },
            },
        },
        {
            $match: {
                orderExpiry: { $gt: new Date() },
            },
        },
        {
            $unwind: '$projects',
        },
        {
            $match: { 'projects.slug': slug },
        },
        {
            $unwind: '$projects.entries',
        },
        {
            $count: 'totalPaidEntries',
        },
    ]);

    return result.length > 0 ? result[0].totalPaidEntries : 0;
};

const visibleProjectDateFields = async (project) => {
    if (!project) throw new Error('no project provided');
    let visibleFields = [];
    for (const field of project.fields) {
        if (field.type === 'date' && field.visible === true) {
            visibleFields.push(field);
        }
    }
    return visibleFields;
};

module.exports = {
    projectEntries,
    fetchEntrySubscriptionsAndPayments,
    getPaidOrdersByEntryId,
    getAllOrdersByEntryId,
    countPaidEntriesInProject,
    visibleProjectDateFields,
};
