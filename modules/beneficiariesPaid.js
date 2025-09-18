const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { createDynamicModel } = require('../models/createDynamicModel');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { formatDate, capitalizeFirstLetter } = require('./helpers');

const getChildrenFromExcel = async () => {
    const filePath = path.join(__dirname, '../config/children.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    const rows = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        rows.push(row.values.slice(1));
    });

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const jsonData = dataRows.map(row => {
        return headers.reduce((acc, key, idx) => {
            acc[key] = row[idx] ?? '';
            return acc;
        }, {});
    });

    const names = jsonData.map(row => {
        const name = row['Name'];
        return name;
    }).filter(val => val !== null);

    return names;
};

const calculateMonths = (order) => {
    const createdAt = new Date(order.createdAt);
    const today = new Date();

    const yearsDiff = today.getFullYear() - createdAt.getFullYear();
    const monthsDiff = today.getMonth() - createdAt.getMonth();

    let months = yearsDiff * 12 + monthsDiff;

    // If day of month hasn’t passed yet, subtract 1
    if (today.getDate() < createdAt.getDate()) {
        months -= 1;
    }

    // Ceiling → if there is any partial month, count it as a full month
    months = Math.max(0, months + 1);

    console.log(months);
    return months;
}

const attachPaymentsToChildren = async (names) => {
    const model = await createDynamicModel('gaza-orphans');
    const children = [];
    for (const name of names) {
        const trimmedName = name.replace(/,+$/, "");

        const entry = await model.findOne({
            name: { $regex: new RegExp(trimmedName, "i") } // case-insensitive
        }).lean();

        const orders = await Order.find({ 'projects.entries.entryId': entry._id, status: 'paid' }).lean();
        let payments = [];
        for (const order of orders) {
            let payment = {};
            const customer = await Customer.findById(order.customerId).lean();
            for (const project of order.projects) {
                if (project.slug !== 'gaza-orphans') continue;
                const months = calculateMonths(order);
                payment = {
                    orderNo: order.orderNo,
                    date: formatDate(order.createdAt),
                    status: capitalizeFirstLetter(order.status),
                    months,
                    totalCostSingleMonth: order.totalCostSingleMonth,
                    total: order.totalCostSingleMonth * months,
                    currency: order.currency,
                    customerEmail: customer.email,
                    customerName: customer.name,
                };
            }
            payments.push(payment);
        }
        if (entry) {
            entry.payments = payments;
            children.push(entry);
        } else {
            console.log(`No entry found for ${name}`);
        }

    }

    return children;
};

const caclulateDonorTotalAmount = (donors) => {
    for (const donor of donors) {
        let totalAmount = 0;
        let iteration = 1;
        for (const child of donor.children) {
            for (const payment of child.payments) {
                if (iteration > 6) continue;
                totalAmount += payment.totalCostSingleMonth;
                iteration++;
            }
        }
        console.log(donor.name, totalAmount);
        donor.totalAmount = totalAmount;
    }
    return donors;
}

const attachChildrenToDonors = async (children) => {
    let donorChildren = [];
    for (const child of children) {
        for (const payment of child.payments) {
            let donor = donorChildren.find(d => d.customer === payment.customerEmail);

            if (!donor) {
                donor = {
                    email: payment.customerEmail,
                    name: payment.customerName,
                    children: []
                };
                donorChildren.push(donor);
            }

            donor.children.push(child);
        }
    }

    donorChildren = caclulateDonorTotalAmount(donorChildren);
    return donorChildren;
};

module.exports = {
    getChildrenFromExcel,
    attachPaymentsToChildren,
    attachChildrenToDonors,
};

// get child
// get donor
// send email
// create log
