const mongoose = require('mongoose');

const handlebars = require('handlebars');

const Customer = require("../models/Customer");
const Project = require("../models/Project");
const Order = require('../models/Order');
const checkValidForm = require("../modules/checkValidForm");
const { saveLog, customerLogs, visibleLogs } = require("../modules/logAction");
const { logTemplates } = require("../modules/logTemplates");
const { getChanges } = require("../modules/getChanges");

exports.viewOrders = async(req,res) => {
    const orders = await Order.find().lean();
    const customers = await Customer.find().lean();
    res.render("orders",{
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
            orders,
            customers,
        }
    })
};