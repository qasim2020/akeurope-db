const mongoose = require('mongoose');

const handlebars = require('handlebars');

const Customer = require("../models/Customer");
const Project = require("../models/Project");
const Order = require('../models/Order');
const checkValidForm = require("../modules/checkValidForm");
const { saveLog, customerLogs, visibleLogs } = require("../modules/logAction");
const { logTemplates } = require("../modules/logTemplates");
const { getChanges } = require("../modules/getChanges");

const {
    getPaginatedOrders,
    getSingleOrder,
    createDraftOrder,
    updateDraftOrder,
    deleteDraftOrder,
} = require('../modules/orders');
const { allProjects } = require('../modules/mw-data');

exports.viewOrders = async(req,res) => {
    const { orders, pagination } = await getPaginatedOrders(req,res);
    const customers = await Customer.find().lean();
    res.render("orders", {
        layout: "dashboard",
        data: {
            layout: req.session.layout,
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: "orders",
            projects: req.allProjects,
            role: req.userPermissions,
            logs: await visibleLogs(req,res),
            sidebarCollapsed: req.session.sidebarCollapsed,
            customers,
            orders,
            pagination,
        }
    })
};

exports.viewOrder = async (req,res) => {
    const { order } = await getSingleOrder(req,res);
    res.render("order",{
        layout: 'dashboard',
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            role: req.userPermissions,
            logs: await visibleLogs(req,res),
            sidebarCollapsed: req.session.sidebarCollapsed,
            projects: req.allProjects,
            activeMenu: 'orders',
            order,
        }
    })
}

exports.getOrdersData = async(req,res) => {
    const { orders, pagination } = await getPaginatedOrders(req,res); 
    res.render("partials/showOrders", {
        layout: false,
        data: {
            orders,
            pagination
        }
    })
}

exports.getEditOrderModal = async(req,res) => {
    const order = await getSingleOrder(req,res);
    const customers = await Customer.find().lean();
    const projects = await Project.find({status: 'active'}).lean();
    res.render("partials/emptyOrderModal",{
        layout: false,
        data: {
            order,
            customers,
            projects
        }
    });
}
