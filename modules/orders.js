const mongoose = require('mongoose');
const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');

const { createDynamicModel } = require('../models/createDynamicModel');
const { generatePagination } = require('../modules/generatePagination');
const { generateSearchQuery } = require('../modules/generateSearchQuery');
const { getCurrencyRates } = require('./getCurrencyRates');

const createPagination = ({
    req,
    totalEntries,
    fieldFilters,
    filtersQuery,
    pageType,
}) => {
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
        pageType,
    };
};

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

const calculationOnProject = async (projectOrdered, requestedCurrencyRate) => {
    const projectOriginal = await Project.findOne({
        slug: projectOrdered.slug,
    }).lean();

    const DynamicModel = await createDynamicModel(projectOrdered.slug);

    const currencyRates = await getCurrencyRates(requestedCurrencyRate);
    const currencyRate = parseFloat(
        currencyRates.rates.get(projectOriginal.currency).toFixed(2),
    );

    let allEntries = await Promise.all(
        projectOrdered.entries.map((entry) =>
            DynamicModel.findById(entry.entryId).lean(),
        ),
    );

    allEntries = allEntries.filter((entry) => entry != null);

    allEntries.forEach((entry) => {
        const matchingOrderedEntry = projectOrdered.entries.find(
            (entryOrdered) =>
                entryOrdered.entryId.toString() === entry._id.toString(),
        );

        if (matchingOrderedEntry) {
            entry.selectedSubscriptions =
                matchingOrderedEntry.selectedSubscriptions || [];
        } else {
            entry.selectedSubscriptions = [];
        }

        projectOriginal.fields.forEach((field) => {
            if (field.subscription == true) {
                entry[field.name] = parseFloat(
                    (entry[field.name] / currencyRate).toFixed(2),
                );
            }
        });

        entry.totalOrderedCost = projectOriginal.fields.reduce(
            (total, field) => {
                if (
                    field.subscription == true &&
                    entry.selectedSubscriptions.includes(field.name)
                ) {
                    total = total + entry[field.name];
                }
                return parseFloat(total.toFixed(2));
            },
            0,
        );

        entry.totalCost = projectOriginal.fields.reduce((total, field) => {
            if (field.subscription == true) {
                total = total + entry[field.name];
            }
            return parseFloat(total.toFixed(2));
        }, 0);
    });

    let projectTotalSingleMonth = 0;
    let projectOrderedSingleMonth = 0;
    let totalSubscriptionCosts = [];

    projectOriginal.fields = projectOriginal.fields.map((field) => {
        if (field.subscription == true) {
            const colSum = allEntries.reduce((total, entry) => {
                total = total + entry[field.name];
                return total;
            }, 0);
            const totalCost = parseFloat(colSum.toFixed(2));
            projectTotalSingleMonth = projectTotalSingleMonth + colSum;
            Object.assign(field, { totalCost: totalCost });
        }

        if (field.subscription == true) {
            const colSum = allEntries.reduce((total, entry) => {
                if (entry.selectedSubscriptions.includes(field.name)) {
                    total = total + entry[field.name];
                }
                return total;
            }, 0);
            projectOrderedSingleMonth = projectOrderedSingleMonth + colSum;
            const totalCost = parseFloat(colSum.toFixed(2));
            if (totalCost !== 0) {
                totalSubscriptionCosts.push({
                    fieldName: field.name,
                    value: totalCost,
                });
            }
            Object.assign(field, {
                totalOrderedCost: totalCost,
            });
        }

        return field;
    });

    projectOriginal.totalSubscriptionCosts = totalSubscriptionCosts;
    projectOriginal.months = parseFloat(projectOrdered.months.toFixed(2));
    projectOriginal.totalCost = parseFloat(projectTotalSingleMonth.toFixed(2));
    projectOriginal.totalOrderedCost = parseFloat(
        projectOrderedSingleMonth.toFixed(2),
    );
    projectOriginal.totalOrderedCostAllMonths = parseFloat(
        (projectOrderedSingleMonth * projectOrdered.months).toFixed(2),
    );
    projectOriginal.selectedCurrency = requestedCurrencyRate;

    return {
        project: projectOriginal,
        allEntries,
    };
};

const fetchEntriesInOrder = async (req, res) => {
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;

    const order = await Order.findOne({
        _id: orderId,
        'projects.slug': projectSlug,
    }).lean();

    const projectOrdered = order.projects.find((p) => p.slug === projectSlug);

    const { project, allEntries } = await calculationOnProject(
        projectOrdered,
        order.currency,
    );

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pagination = createPagination({
        req,
        totalEntries: allEntries.length,
        pageType: 'entries',
    });

    return {
        select: countSubscribedEntries(allEntries),
        project,
        entries: allEntries.slice(skip, skip + limit),
        pagination,
    };
};

const fetchOrderByProject = async (req, res) => {
    let order = await Order.findOne({
        _id: req.query.orderId,
        'projects.slug': req.params.slug,
    }).lean();

    if (!order) throw new Error("Can't fetch order. No order found!");

    order.project = order.projects.find(
        (project) => project.slug === req.params.slug,
    );
    return order;
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

const updateDraftOrder = async (req, res) => {
    let checkProject = await Project.findOne({ slug: req.params.slug }).lean();
    if (!checkProject)
        throw new Error(`Project "${req.params.slug}" not found`);

    const orderId = req.query.orderId;
    const projectSlug = checkProject.slug;

    if (req.query.customerId) {
        const customerId = req.query.customerId;
        await Order.updateOne(
            { _id: orderId },
            { $set: { customerId: customerId } },
        );
    }

    if (req.query.currency) {
        const currency = req.query.currency;
        await Order.updateOne(
            { _id: orderId },
            { $set: { currency: currency } },
        );
    }

    if (req.query.months > 0) {
        const updatedMonths = req.query.months;
        await Order.updateOne(
            { _id: orderId, 'projects.slug': projectSlug },
            { $set: { 'projects.$.months': updatedMonths } },
        );
    }

    if (req.query.subscriptions && !req.query.entryId) {
        const subscriptions = req.query.subscriptions;
        if (subscriptions === 'empty') {
            await Order.updateOne(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $unset: {
                        'projects.$.entries.$[].selectedSubscriptions': '',
                    },
                },
            );
        } else {
            await Order.updateOne(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[].selectedSubscriptions':
                            subscriptions.split(','),
                    },
                },
            );
        }
    }

    if (req.query.entryId && req.query.subscriptions) {
        const entryId = req.query.entryId;
        const subscriptions = req.query.subscriptions;
        if (subscriptions === 'empty') {
            await Order.updateOne(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $unset: {
                        'projects.$.entries.$[entry].selectedSubscriptions': '',
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                },
            );
        } else {
            const subscriptionsArray = subscriptions.split(',');
            await Order.updateOne(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[entry].selectedSubscriptions':
                            subscriptionsArray,
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                },
            );
        }
    }

    if (req.query.addProject) {
        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );
        const updatedProject = await makeProjectForOrder(project, allEntries);
        await Order.updateOne(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $pull: { projects: { slug: projectSlug } },
            },
        );
        await Order.updateOne(
            { _id: orderId },
            {
                $push: { projects: updatedProject },
            },
        );
    }

    if (req.query.replaceProject) {
        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );
        const updatedProject = await makeProjectForOrder(project, allEntries);
        await Order.updateOne(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $set: { 'projects.$': updatedProject },
            },
        );
    }

    if (req.query.deleteProject) {
        await Order.updateOne(
            { _id: orderId, 'projects.slug': projectSlug },
            {
                $pull: { projects: { slug: projectSlug } },
            },
        );
        return {
            message: 'Project deleted from order!',
        };
    }

    if (req.query.deleteOrder) {
        await Order.deleteOne({ _id: orderId });
        return {
            message: 'Order deleted!',
        };
    }

    const order = await fetchOrderByProject(req, res);

    const { entries, project, pagination, select } = await fetchEntriesInOrder(
        req,
        res,
    );

    return {
        orderId: order._id,
        project,
        entries,
        pagination,
        select,
        toggleState: req.query.toggleState,
        months: order.project.months,
    };
};

const createDraftOrder = async (req, res) => {
    const checkProject = await Project.findOne({
        slug: req.params.slug,
    }).lean();
    if (!checkProject)
        throw new Error(`Project "${req.params.slug}" not found`);

    const { project, allEntries } = await getOldestPaidEntries(
        req,
        checkProject,
    );

    const updatedProject = makeProjectForOrder(project, allEntries);

    const order = new Order({
        customerId: req.params.customerId,
        currency: req.query.currency,
        projects: [updatedProject],
    });

    try {
        await order.save();
        req.query.orderId = order._id;
        return await updateDraftOrder(req, res);
    } catch (error) {
        console.error('Error saving order:', error);
        throw error;
    }
};

const getPaginatedOrders = async (req, res) => {
    const orders = await Order.find().sort({ _id: -1 }).lean();

    const pagination = createPagination({
        req,
        totalEntries: orders.length,
        pageType: 'orders',
    });

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const ordersPaginated = orders.slice(skip, skip + limit);

    for (const order of ordersPaginated) {
        order.customer = await Customer.findById(order.customerId).lean();
        order.projects = await Promise.all(
            order.projects.map(async (val) => {
                const { project, allEntries: entries } =
                    await calculationOnProject(val, order.currency);
                return {
                    project,
                    entries: entries && entries.slice(0, 10),
                };
            }),
        );
        order.totalCost = order.projects.reduce((total, project) => {
            project = project.project;
            return parseFloat(
                (total + project.totalOrderedCostAllMonths).toFixed(2),
            );
        }, 0);
    }

    return {
        orders: ordersPaginated,
        pagination,
    };
};

const countSubscribedEntries = (entries) => {
    return entries.filter((entry) => entry.selectedSubscriptions.length > 0)
        .length;
};

const calculateOrder = async (order) => {
    order.projects = await Promise.all(
        order.projects.map(async (val) => {
            const { project, allEntries } = await calculationOnProject(
                val,
                order.currency,
            );
            return {
                project: project,
                select: countSubscribedEntries(allEntries),
                allEntries,
                entries: allEntries && allEntries.slice(0, 10),
                toggleState: 'hide',
            };
        }),
    );
    order.totalCost = order.projects.reduce((total, project) => {
        project = project.project;
        return parseFloat(
            (total + project.totalOrderedCostAllMonths).toFixed(2),
        );
    }, 0);

    return order;
};

const formatOrder = async (req, order) => {
    order.customer = await Customer.findOne({
        _id: order.customerId,
    }).lean();

    order.customer.previousPayments = await Order.find({
        customerId: order.customerId,
        status: 'paid',
    });

    for (const project of order.projects) {
        const detail = await Project.findOne({ slug: project.slug }).lean();
        const entryModel = await createDynamicModel(project.slug);

        const pagination = createPagination({
            req,
            totalEntries: project.entries.length,
            pageType: 'payment-modal',
        });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        project.entries = project.entries.slice(skip, skip + limit);

        for (const entry of project.entries) {
            entry.detail = await entryModel
                .findOne({ _id: entry.entryId })
                .lean();
        }

        project.detail = detail;
        project.pagination = pagination;
        project.entriesCount = countSubscribedEntries(project.entries);
        project.toggleState = req.query.toggleState || 'hide';
    }

    return order;
};

const getSingleOrder = async (req, res) => {
    const checkOrder = await Order.findOne({ _id: req.params.orderId }).lean();
    let order;
    if (!checkOrder.totalCost) {
        console.log('totalCost does not exist - calculating order');
        const calculatedOrder = await calculateOrder(checkOrder);
        console.log(calculatedOrder);
        await addPaymentsToOrder(calculatedOrder);
        const orderInDb = await Order.findOne({ _id: req.params.orderId }).lean();
        order = await formatOrder(req,orderInDb);
    } else {
        order = await formatOrder(req,checkOrder);
    }
    order.customer = await Customer.findById(order.customerId).lean();
    return order;
};

const updateOrderStatus = async (req, status) => {
    const orderId = req.params.orderId || req.query.orderId;
    await Order.updateOne({ _id: orderId }, { $set: { status: status } });
    return {
        message: 'Order status changed!',
    };
};

const addPaymentsToOrder = async (order) => {

    for (const calcProject of order.projects) {
        const { project, allEntries: entries } = calcProject;
        const projectSlug = project.slug;
        const fields = (await Project.findOne({ slug: projectSlug })).fields;
        const filteredEntries = entries.filter(
            (entry) => entry.selectedSubscriptions.length > 0,
        );
        const cleanedEntries = filteredEntries.map((entry) => {
            const allSubscriptions = [];
            const selectedSubscriptions = [];
            fields.forEach((field) => {
                if (field.subscription == true) {
                    if (entry.selectedSubscriptions.includes(field.name)) {
                        selectedSubscriptions.push({
                            fieldName: field.name,
                            value: entry[field.name],
                        });
                    }

                    allSubscriptions.push({
                        fieldName: field.name,
                        value: entry[field.name],
                    });
                }
            });
            entry.selectedSubscriptionsPair = selectedSubscriptions;
            entry.allSubscriptionsPair = allSubscriptions;
            return entry;
        });
        for (const entry of cleanedEntries) {
            const {
                _id: entryId,
                totalCost: totalCostAllSubscriptions,
                totalOrderedCost: totalCost,
                selectedSubscriptions,
                selectedSubscriptionsPair,
                allSubscriptionsPair,
            } = entry;
            await Order.updateOne(
                { _id: order._id },
                {
                    $set: {
                        totalCost: order.totalCost,
                        'projects.$[project].totalCostSingleMonth':
                            project.totalOrderedCost,
                        'projects.$[project].totalSubscriptionCosts':
                            project.totalSubscriptionCosts,
                        'projects.$[project].totalCostAllMonths':
                            project.totalOrderedCostAllMonths,
                        'projects.$[project].months': project.months,
                        'projects.$[project].entries.$[entry].totalCost':
                            totalCost,
                        'projects.$[project].entries.$[entry].totalCostAllSubscriptions':
                            totalCostAllSubscriptions,
                        'projects.$[project].entries.$[entry].selectedSubscriptions':
                            selectedSubscriptions,
                        'projects.$[project].entries.$[entry].selectedSubscriptionsPair':
                            selectedSubscriptionsPair,
                        'projects.$[project].entries.$[entry].allSubscriptionsPair':
                            allSubscriptionsPair,
                    },
                },
                {
                    arrayFilters: [
                        { 'project.slug': projectSlug },
                        { 'entry.entryId': entryId },
                    ],
                },
            );
        }
    }
    await Order.updateOne(
        { _id: order._id },
        {
            $pull: {
                'projects.$[].entries': {
                    $or: [
                        { selectedSubscriptions: { $size: 0 } },
                        { selectedSubscriptions: { $exists: false } },
                    ],
                },
            },
        },
    );
    return {
        message: 'Order payments added!',
    };
};

const openOrderProjectWithEntries = async (req, order) => {
    order.customer = await Customer.findOne({
        _id: order.customerId,
    }).lean();

    order.customer.previousPayments = await Order.find({
        customerId: order.customerId,
        status: 'paid',
    });

    for (const project of order.projects) {
        const detail = await Project.findOne({ slug: project.slug }).lean();
        const entryModel = await createDynamicModel(project.slug);

        const pagination = createPagination({
            req,
            totalEntries: project.entries.length,
            pageType: 'payment-modal',
        });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        project.entries = project.entries.slice(skip, skip + limit);

        for (const entry of project.entries) {
            entry.detail = await entryModel
                .findOne({ _id: entry.entryId })
                .lean();
        }

        project.detail = detail;
        project.pagination = pagination;
        project.entriesCount = countSubscribedEntries(project.entries);
    }

    return order;
};

const getPendingOrderEntries = async (req, res) => {
    const orderId = req.params.orderId;
    const projectSlug = req.params.slug;
    const order = await Order.findById(orderId).lean();
    const project = order.projects.find(
        (project) => project.slug === projectSlug,
    );
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const pagination = createPagination({
        req,
        totalEntries: project.entries.length,
        pageType: 'payment-modal',
    });
    const entryModel = await createDynamicModel(projectSlug);
    project.entries = project.entries.slice(skip, skip + limit);
    for (const entry of project.entries) {
        entry.detail = await entryModel.findOne({ _id: entry.entryId }).lean();
    }
    project.detail = await Project.findOne({ slug: projectSlug }).lean();
    project.pagination = pagination;
    debugger;
    return {
        order,
        project,
    };
};

module.exports = {
    createDraftOrder,
    updateDraftOrder,
    getPaginatedOrders,
    getSingleOrder,
    updateOrderStatus,
    addPaymentsToOrder,
    openOrderProjectWithEntries,
    getPendingOrderEntries,
};
