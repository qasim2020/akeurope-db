const User = require('../models/User');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const Order = require('../models/Order');
const File = require('../models/File');
const Subscription = require('../models/Subscription');
const { saveLog, visibleLogs, orderLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const {
    getPaginatedOrders,
    getSingleOrder,
    updateOrderStatus,
    formatOrder,
    getPaymentByOrderId,
    getSubscriptionByOrderId,
    getSubscriptionsByOrderId,
    cleanOrder,
} = require('../modules/orders');
const { getVippsPaymentByOrderId, getVippsSubscriptionByOrderId } = require('../modules/vippsMain');
const { deleteInvoice, sendInvoiceToCustomer, sendThanksToCustomer } = require('../modules/invoice');
const Log = require('../models/Log');
const { createDynamicModel } = require('../models/createDynamicModel');

exports.viewOrders = async (req, res) => {
    try {
        const { orders, pagination } = await getPaginatedOrders(req, res);

        for (const order of orders) {
            order.stripeInfo = (await getPaymentByOrderId(order._id)) || (await getSubscriptionByOrderId(order._id));
            order.vippsInfo = (await getVippsPaymentByOrderId(order.vippsReference)) || (await getVippsSubscriptionByOrderId(order.vippsAgreementId));
        };

        const customers = await Customer.find().lean();
        res.render('orders', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userId: req.session.user._id,
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: 'orders',
                projects: req.allProjects,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                sidebarCollapsed: req.session.sidebarCollapsed,
                customers,
                orders,
                pagination,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.viewOrder = async (req, res) => {
    try {
        let order = await getSingleOrder(req, res);

        if (!order.customerId) {
            order = await Subscription.findById(req.params.orderId).lean();
            if (!order) throw new Error('Order not found');
            order.customer = await Customer.findById(order.customerId).lean();
        }

        const payment = await getPaymentByOrderId(order._id);
        const subscriptions = await getSubscriptionsByOrderId(order._id);

        order.vippsInfo = (await getVippsPaymentByOrderId(order.vippsReference)) || 
            (await getVippsSubscriptionByOrderId(order.vippsAgreementId));

        if (payment) order.payment = payment;
        if (subscriptions) order.subscriptions = subscriptions;

        const files = await File.find({ 'links.entityId': req.params.orderId }).sort({ createdAt: -1 }).lean();

        for (const file of files) {
            if (file.uploadedBy?.actorType === 'user') {
                const user = await User.findById(file.uploadedBy?.actorId).lean();
                file.actorName = user.name;
                file.actorRole = user.role;
            }
            if (file.uploadedBy?.actorType === 'customer') {
                file.actorName = (await Customer.findById(file.uploadedBy?.actorId).lean()).name;
            }
        }

        res.render('order', {
            layout: 'dashboard',
            data: {
                userId: req.session.user._id,
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                orderLogs: await orderLogs(req, res),
                sidebarCollapsed: req.session.sidebarCollapsed,
                projects: req.allProjects,
                customers: await Customer.find().lean(),
                activeMenu: 'orders',
                order,
                orderJson: JSON.stringify(order),
                files,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getOrderData = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        res.render('partials/showOrder', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getOrdersData = async (req, res) => {
    try {
        const { orders, pagination } = await getPaginatedOrders(req, res);

        for (const order of orders) {
            order.stripeInfo = (await getPaymentByOrderId(order._id)) || (await getSubscriptionByOrderId(order._id));
            order.vippsInfo = (await getVippsPaymentByOrderId(order.vippsReference)) || (await getVippsSubscriptionByOrderId(order._id));
        };

        res.render('partials/showOrders', {
            layout: false,
            data: {
                orders,
                pagination,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getEditOrderModal = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        const customers = await Customer.find().lean();
        const projects = await Project.find().lean();
        res.render('partials/emptyOrderModal', {
            layout: false,
            data: {
                order,
                customers,
                projects,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.getOrderTotalCost = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);
        res.render('partials/components/afterProjectCards', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server Error',
            error: error,
        });
    }
};

exports.changeOrderStatus = async (req, res) => {
    try {
        await cleanOrder(req.params.orderId || req.query.orderId);
        const order = await updateOrderStatus(req, res);
        res.status(200).render('partials/components/invoice-status-buttons', {
            layout: false,
            data: {
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error,
        });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = (await Order.findById(orderId).lean()) || (await Subscription.findById(orderId).lean());
        await deleteInvoice(orderId);
        await saveLog(
            logTemplates({
                type: 'orderDeleted',
                entity: order,
                actor: req.session.user,
            }),
        );
        await saveLog(
            logTemplates({
                type: 'customerOrderDeleted',
                entity: await Customer.findById(order.customerId).lean(),
                order: order,
                actor: req.session.user,
            }),
        );
        if (order.projects?.length > 0) {
            for (const project of order.projects) {
                project.detail = await Project.findOne({ slug: project.slug }).lean();
                const model = await createDynamicModel(project.slug);
                for (const entryInOrder of project.entries) {
                    const entry = await model.findById(entryInOrder.entryId).lean();
                    await saveLog(
                        logTemplates({
                            type: 'entryRemovedFromOrder',
                            entity: entry,
                            order,
                            project,
                            actor: req.session.user,
                        }),
                    );
                }
            }
        }

        await Order.deleteOne({ _id: orderId });
        await Subscription.deleteOne({ _id: orderId });

        res.status(200).send('Order & Invoice deleted!');
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error,
        });
    }
};

exports.emailInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        const customer = await Customer.findById(order.customerId).lean();
        await sendInvoiceToCustomer(order, customer);
        res.status(200).send('Email sent successfully!');
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error,
        });
    }
};

exports.emailThanks = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        const customer = await Customer.findById(order.customerId).lean();
        await sendThanksToCustomer(order, customer);
        res.status(200).send('Email sent successfully!');
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error,
        });
    }
};

exports.getOrderLogs = async (req, res) => {
    try {
        res.render('partials/showOrderLogs', {
            layout: false,
            data: {
                order: { _id: req.params.orderId },
                orderLogs: await orderLogs(req, res),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occured while fetching logs',
            details: error.message,
        });
    }
};

exports.getOrderProjects = async (req, res) => {
    try {
        const orderInDb = await Order.findOne({
            _id: req.params.orderId,
        }).lean();

        const order = await formatOrder(req, orderInDb);

        for (const project of order.projects) {
            project.detail = await Project.findOne({
                slug: project.slug,
            }).lean();
        }

        res.render('partials/showOrderEntries', {
            layout: false,
            data: {
                projects: order.projects ? order.projects : [],
                order,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated order',
            details: error.message,
        });
    }
};
