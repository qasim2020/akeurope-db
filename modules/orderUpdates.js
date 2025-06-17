const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { saveLog } = require('../modules/logAction');
const { getOldestPaidEntries, makeProjectForOrder, validateQuery, makeEntriesForWidgetOrder: makeEntriesForOrder } = require('../modules/ordersFetchEntries');

const runQueriesOnOrder = async (req, res) => {
    await validateQuery(req, res);

    let order;
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const checkProject = await Project.findOne({ slug: projectSlug }).lean();
    const existingOrder = await Order.findById(req.query.orderId).lean();

    if (existingOrder.status !== 'draft') return existingOrder;

    const existingCustomer = await Customer.findById(existingOrder.customerId).lean();

    if (req.query.addNewEntries) {
        const addEntries = parseInt(req.query.addNewEntries);
        order = await Order.findById(orderId).lean();
        const currentEntries = order.projects.flatMap((project) => project.entries);
        req.query.select = currentEntries.length + addEntries;

        const { project, allEntries } = await getOldestPaidEntries(req, checkProject);

        const newEntries = allEntries
            .filter((newEntry) => {
                return !currentEntries.some((existingEntry) => existingEntry.entryId.toString() === newEntry._id.toString());
            })
            .slice(0, addEntries);

        const entriesForOrder = makeEntriesForOrder(newEntries, addEntries, project);
        order = await Order.findOneAndUpdate(
            { _id: order._id, 'projects.slug': checkProject.slug },
            {
                $push: {
                    'projects.$.entries': { $each: entriesForOrder },
                },
            },
            {
                lean: true,
                new: true,
            },
        );
    }

    if (req.query.customerId) {
        const customerId = req.query.customerId;
        order = await Order.findOneAndUpdate({ _id: orderId }, { $set: { customerId: customerId } }, { new: true, lean: true });
    }

    if (req.query.currency) {
        const currency = req.query.currency;
        order = await Order.findOneAndUpdate({ _id: orderId }, { $set: { currency: currency } }, { new: true, lean: true });
    }

    if (req.query.months > 0) {
        const updatedMonths = req.query.months;
        order = await Order.findOneAndUpdate(
            { _id: orderId, 'projects.slug': projectSlug },
            { $set: { 'projects.$.months': updatedMonths } },
            { new: true, lean: true },
        );
    }

    if (req.query.subscriptions && !req.query.entryId) {
        const subscriptions = req.query.subscriptions;
        const excludedEntries = req.query.excludedEntries;
        const excludedEntriesId = excludedEntries ? excludedEntries.map((entry) => entry.entryId) : [];
        if (subscriptions === 'empty') {
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $unset: {
                        'projects.$.entries.$[].selectedSubscriptions': '',
                    },
                },
                {
                    new: true,
                    lean: true,
                },
            );
        } else {
            const tempOrder = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions': subscriptions.split(','),
                    },
                },
                {
                    new: true,
                    lean: true,
                    arrayFilters: [
                        {
                            'entry.entryId': { $nin: excludedEntriesId },
                        },
                    ],
                },
            );

            for (const entry of excludedEntries) {
                order = await Order.findOneAndUpdate(
                    { _id: orderId, 'projects.slug': projectSlug },
                    {
                        $set: {
                            'projects.$.entries.$[entry].selectedSubscriptions': entry.validSubscriptions,
                        },
                    },
                    {
                        new: true,
                        lean: true,
                        arrayFilters: [
                            {
                                'entry.entryId': entry.entryId,
                            },
                        ],
                    },
                );
            }

            if (excludedEntries.length == 0) {
                order = tempOrder;
            }
        }

    }

    if (req.query.entryId && req.query.subscriptions) {
        const entryId = req.query.entryId;
        const subscriptions = req.query.subscriptions;
        if (subscriptions === 'empty') {
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions': [],
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                    new: true,
                    lean: true,
                },
            );
        } else {
            const subscriptionsArray = subscriptions.split(',');
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions': subscriptionsArray,
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                    new: true,
                    lean: true,
                },
            );
        }

    }

    if (req.query.addProject) {
        const { project, allEntries } = await getOldestPaidEntries(req, checkProject);

        await Order.updateOne(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $pull: { projects: { slug: projectSlug } },
            },
        );

        const updatedProject = await makeProjectForOrder(project, allEntries);

        order = await Order.findOneAndUpdate(
            { _id: orderId },
            {
                $push: { projects: updatedProject },
            },
            {
                new: true,
                lean: true,
            },
        );

    }

    if (req.query.replaceProject) {
        const { project, allEntries } = await getOldestPaidEntries(req, checkProject);
        const updatedProject = await makeProjectForOrder(project, allEntries);
        order = await Order.findOneAndUpdate(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $set: { 'projects.$': updatedProject },
            },
            {
                new: true,
                lean: true,
            },
        );
    }

    if (req.query.deleteProject) {
        order = await Order.findOneAndUpdate(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $pull: { projects: { slug: projectSlug } },
            },
            {
                new: true,
                lean: true,
            },
        );
    }

    return order;
};

module.exports = { runQueriesOnOrder };
