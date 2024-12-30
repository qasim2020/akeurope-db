const Customer = require('../models/Customer');
const Project = require('../models/Project');
const Order = require('../models/Order');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const {
    getPaginatedOrders,
    getSingleOrder,
    updateOrderStatus,
    addPaymentsToOrder,
    openOrderProjectWithEntries,
} = require('../modules/orders');
const { generateInvoice, deleteInvoice, sendInvoiceToCustomer} = require('../modules/invoice');

exports.viewOrders = async (req, res) => {
    try {
        const { orders, pagination } = await getPaginatedOrders(req, res);
        const customers = await Customer.find().lean();
        res.render('orders', {
            layout: 'dashboard',
            data: {
                layout: req.session.layout,
                userName: req.session.user.name,
                userRole:
                    req.session.user.role.charAt(0).toUpperCase() +
                    req.session.user.role.slice(1),
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
        const order = await getSingleOrder(req, res);
        res.render('order', {
            layout: 'dashboard',
            data: {
                userName: req.session.user.name,
                userRole:
                    req.session.user.role.charAt(0).toUpperCase() +
                    req.session.user.role.slice(1),
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                sidebarCollapsed: req.session.sidebarCollapsed,
                projects: req.allProjects,
                activeMenu: 'orders',
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
        const projects = await Project.find({ status: 'active' }).lean();
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
        const orderId = req.params.orderId;
        const { status } = req.body;
        const order = await Order.findOneAndUpdate(
            { _id: orderId }, 
            {
                $set: {
                    status: status,
                },
            },
            {
                new: true, 
                lean: true, 
            }
        );
        res.status(200).render('partials/components/invoice-status-buttons', {
            layout: false,
            data: {
                order
            }
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
        await deleteInvoice(orderId);
        await Order.deleteOne({ _id: orderId });
        res.status(200).send('Order & Invoice deleted!');
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error,
        });
    }
};

exports.emailInvoice = async(req,res) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        const customer = await Customer.findById(order.customerId).lean();
        await sendInvoiceToCustomer(order, customer);
        res.status(200).send('Email sent successfully!');
    } catch (error) {
        console.log(error);
        res.status(404).send({
            error: error
        })
    }
}

// exports.checkout = async (req, res) => {
//     try {
//         const order = await getSingleOrder(req, res);
//         await updateOrderStatus(req, 'pending payment');
//         await addPaymentsToOrder(order);
//         res.status(200).send('Order checked out!');
//     } catch (error) {
//         console.log(error);
//         res.status(404).send(error);
//     }
// };

// exports.getPaymentModal = async (req, res) => {
//     try {
//         const checkOrder = await Order.findById(req.params.orderId).lean();
//         let order;
//         if (checkOrder.status == 'draft') {
//             const draftOrder = await getSingleOrder(req, res);
//             await generateInvoice(draftOrder);
//             await addPaymentsToOrder(draftOrder);
//             await updateOrderStatus(req, 'pending payment');
//             order = await Order.findById(req.params.orderId).lean();
//         } else {
//             order = checkOrder;
//         }
//         order = await openOrderProjectWithEntries(req, order);
//         res.render('partials/emptyPaymentModal', {
//             layout: false,
//             data: {
//                 order,
//             },
//         });
//     } catch (error) {
//         console.log(error);
//         res.status(404).render('error', {
//             heading: 'Server Error',
//             error: error,
//         });
//     }
// };
