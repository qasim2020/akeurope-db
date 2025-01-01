const Project = require('../models/Project');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { logTemplates } = require('../modules/logTemplates');
const { saveLog } = require('../modules/logAction');
const {
    getOldestPaidEntries,
    makeProjectForOrder,
} = require('../modules/ordersFetchEntries');
const { createDynamicModel } = require('../models/createDynamicModel');
const { camelCaseWithCommaToNormalString } = require('../modules/helpers');

const runQueriesOnOrder = async (req, res) => {
    let order;
    const orderId = req.query.orderId;
    const projectSlug = req.params.slug;
    const checkProject = await Project.findOne({ slug: projectSlug }).lean();
    const existingOrder = await Order.findById(req.query.orderId).lean();
    const existingCustomer = await Customer.findById(
        existingOrder.customerId,
    ).lean();

    if (req.query.customerId) {
        const customerId = req.query.customerId;

        order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: { customerId: customerId } },
            { new: true, lean: true },
        );

        const newCustomer = await Customer.findById(order.customerId).lean();

        if (existingCustomer.email != newCustomer.email) {
            await saveLog(
                logTemplates({
                    type: 'customerRemovedFromOrder',
                    entity: existingCustomer,
                    order,
                    customer: existingCustomer,
                    actor: req.session.user,
                }),
            );

            await saveLog(
                logTemplates({
                    type: 'customerAddedToOrder',
                    entity: newCustomer,
                    order,
                    customer: newCustomer,
                    actor: req.session.user,
                }),
            );

            await saveLog(
                logTemplates({
                    type: 'orderCustomerChanged',
                    entity: order,
                    changes: [
                        {
                            key: 'customer',
                            oldValue: existingCustomer.email,
                            newValue: newCustomer.email,
                        },
                    ],
                    actor: req.session.user,
                }),
            );
        }
    }

    if (req.query.currency) {
        const currency = req.query.currency;
        order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: { currency: currency } },
            { new: true, lean: true },
        );

        if (order.currency != existingOrder.currency) {
            await saveLog(
                logTemplates({
                    type: 'orderCurrencyChanged',
                    entity: order,
                    changes: [
                        {
                            key: 'currency',
                            oldValue: existingOrder.currency,
                            newValue: currency,
                        },
                    ],
                    actor: req.session.user,
                }),
            );
        }
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
            order = await Order.findOneAndUpdate(
                { _id: orderId, 'projects.slug': projectSlug },
                {
                    $set: {
                        'projects.$.entries.$[].selectedSubscriptions':
                            subscriptions.split(','),
                    },
                },
                {
                    new: true,
                    lean: true,
                },
            );
        }

        await saveLog(
            logTemplates({
                type: 'orderColumnSubscriptionChanged',
                entity: order,
                order,
                project: checkProject,
                changes: [
                    {
                        key: 'Subscriptions',
                        newValue: subscriptions,
                    },
                ],
                actor: req.session.user,
            }),
        );
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
                        'projects.$.entries.$[entry].selectedSubscriptions':
                            subscriptionsArray,
                    },
                },
                {
                    arrayFilters: [{ 'entry.entryId': entryId }],
                    new: true,
                    lean: true,
                },
            );
        }

        const project = existingOrder.projects.find(
            (p) => p.slug === projectSlug,
        );
        project.detail = checkProject;
        if (project) {
            const entry = project.entries.find((e) => e.entryId.toString() === entryId);
            if (entry) {
                const existingSubscriptions =
                    entry.selectedSubscriptions.join(',');
                const model = await createDynamicModel(project.slug);
                const entryDetail = await model.findById(entry.entryId).lean();
                await saveLog(
                    logTemplates({
                        type: 'entrySubscriptionChanged',
                        entity: entryDetail,
                        order,
                        project,
                        changes: [
                            {
                                key: 'Subscriptions',
                                oldValue: camelCaseWithCommaToNormalString(existingSubscriptions),
                                newValue: camelCaseWithCommaToNormalString(subscriptions),
                            },
                        ],
                        actor: req.session.user,
                    }),
                );
                await saveLog(
                    logTemplates({
                        type: 'orderEntrySubscriptionChanged',
                        entity: order,
                        entry: entryDetail,
                        project,
                        changes: [
                            {
                                key: 'Subscriptions',
                                oldValue: camelCaseWithCommaToNormalString(existingSubscriptions),
                                newValue: camelCaseWithCommaToNormalString(subscriptions),
                            },
                        ],
                        actor: req.session.user,
                    }),
                );
            }
        }
    }

    if (req.query.addProject) {
        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );

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

        const newProject = await Project.findOne({
            slug: updatedProject.slug,
        }).lean();

        newProject.selection = updatedProject;

        await saveLog(
            logTemplates({
                type: 'orderProjectSelection',
                entity: order,
                project: newProject,
                actor: req.session.user,
            }),
        );
    }

    if (req.query.replaceProject) {
        const { project, allEntries } = await getOldestPaidEntries(
            req,
            checkProject,
        );
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
        const newProject = await Project.findOne({
            slug: updatedProject.slug,
        }).lean();
        newProject.selection = updatedProject;
        await saveLog(
            logTemplates({
                type: 'orderProjectSelection',
                entity: order,
                project: newProject,
                actor: req.session.user,
            }),
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
        await saveLog(
            logTemplates({
                type: 'orderProjectRemoved',
                entity: checkProject,
                order,
                project: checkProject,
                actor: req.session.user,
            }),
        );
    }

    if (req.query.deleteOrder) {
        await Order.deleteOne({ _id: orderId });

        await saveLog(
            logTemplates({
                type: 'orderDeleted',
                entity: existingOrder,
                actor: req.session.user,
            }),
        );

        return {
            message: 'Order deleted!',
        };
    }

    return order;
};

module.exports = { runQueriesOnOrder };
