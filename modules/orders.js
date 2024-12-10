const Project = require('../models/Project');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');

const { createDynamicModel } = require('../models/createDynamicModel');
const { generatePagination } = require('../modules/generatePagination');
const { generateSearchQuery } = require('../modules/generateSearchQuery');

const createPagination = (req, totalEntries, fieldFilters, filtersQuery) => {
    const limit = parseInt(req.query.limit) || 10;
    const totalPages = Math.ceil(totalEntries / limit);
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || '_id';
    return {
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
    };
};

const getOldestPaidEntries = async (req, project) => {
    const DynamicModel = await createDynamicModel(project.slug);
    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const selectCount = parseInt(req.query.select) || 50;

    const lastPayments = await Payment.aggregate([
        { $match: { entryId: { $in: [] } } },
        { $sort: { date: 1 } },
        {
            $group: {
                _id: '$entryId',
                lastPaid: { $first: '$date' },
            },
        },
    ]);

    let paidEntryIds = lastPayments.map((payment) => payment._id);
    let neverPaidCount = selectCount - paidEntryIds.length;

    let entriesWithPayments = [];
    if (paidEntryIds.length > 0) {
        entriesWithPayments = await DynamicModel.find({
            _id: { $in: paidEntryIds },
            ...searchQuery,
        }).lean();
    }

    let entriesWithoutPayments = [];
    if (neverPaidCount > 0) {
        entriesWithoutPayments = await DynamicModel.find(searchQuery)
            .limit(neverPaidCount)
            .lean();
    }

    const subscriptions = await Subscription.find({
        entryId: {
            $in: paidEntryIds.concat(entriesWithoutPayments.map((e) => e._id)),
        },
    }).lean();

    const lastPaymentsMap = Object.fromEntries(
        lastPayments.map(({ _id, lastPaid }) => [_id.toString(), lastPaid]),
    );

    const subscriptionsMap = Object.fromEntries(
        subscriptions.map((sub) => [sub.entryId.toString(), sub]),
    );

    entriesWithPayments.forEach((entry) => {
        entry.lastPaid = lastPaymentsMap[entry._id.toString()] || null;
        entry.subscriptions = subscriptionsMap[entry._id.toString()] || null;
    });

    entriesWithoutPayments.forEach((entry) => {
        entry.lastPaid = null;
        entry.subscriptions = subscriptionsMap[entry._id.toString()] || null;
    });

    let allEntries = [...entriesWithoutPayments, ...entriesWithPayments];
    // const totalEntries = allEntries.length;
    const pagination = createPagination(req, allEntries.length);
    allEntries = allEntries.slice(skip, skip + limit);
    
    return {
        entries: allEntries,
        pagination
    }
};

const updateDraftOrder = async (req, res) => {};

const createDraftOrder = async (req, res) => {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    const { entries, pagination } = await getOldestPaidEntries(req, project);

    entries.forEach((entry) => {
        entry.totalCost = project.fields.reduce((total, field) => {
            if (field.subscription == true) {
                total = total + entry[field.name];
            }
            return total;
        }, 0);
    });

    let grandTotal = 0;

    project.fields = project.fields.map((field) => {
        if (field.subscription == true) {
            const colSum = entries.reduce((total, entry) => {
                total = total + entry[field.name];
                return total;
            }, 0);
            grandTotal = grandTotal + colSum;
            Object.assign(field, { totalCost: colSum });
        }

        return field;
    });

    let order = {};

    order.grandTotal = grandTotal;

    return { order, project, entries, pagination };
};

module.exports = { createDraftOrder };
