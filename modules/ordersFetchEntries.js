const { generateSearchQuery } = require('../modules/generateSearchQuery');
const { createDynamicModel } = require('../models/createDynamicModel');

const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');

const getOldestPaidEntries = async (req, project) => {
    const DynamicModel = await createDynamicModel(project.slug);
    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);
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

    return {
        project,
        allEntries,
    };
};


const makeProjectForOrder = (project, allEntries) => {
    return {
        slug: project.slug,
        months: 1,
        entries: allEntries.map((entry) => {
            return {
                entryId: entry._id,
                selectedSubscriptions: project.fields
                    .filter(
                        (field) =>
                            field.subscription &&
                            entry[field.name] != undefined,
                    )
                    .map((field) => field.name),
            };
        }),
    };
};


module.exports = { getOldestPaidEntries, makeProjectForOrder };