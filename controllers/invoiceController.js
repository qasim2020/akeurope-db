const Customer = require('../models/Customer');
const Project = require('../models/Project');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const {
    getPaginatedOrders,
    getSingleOrder,
    createDraftOrder,
    updateDraftOrder,
} = require('../modules/orders');
const { allProjects } = require('../modules/mw-data');

const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');

exports.getInvoice = async (req, res) => {
    try {
        const order = await getSingleOrder(req, res);

        if (!order) {
            res.status(404).render('error', {heading: 'Order not found'});            
            return;
        }

        if (order.projects.length == 0) {
            res.status(404).render('error', {heading: 'No projects found'});            
            return;
        }

        const invoicePath = await generateInvoicePDF(order);

        res.sendFile(invoicePath);
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(404).render('error', {heading: 'No projects found', error});            
    }
};

const generateInvoicePDF = async (order) => {
    const invoiceDir = path.join(__dirname, '../invoices');
    const invoicePath = path.join(
        invoiceDir,
        `${order.customer.email}_order_no_${order.orderNo}.pdf`,
    );

    await fs.ensureDir(invoiceDir);

    return new Promise((resolve, reject) => {
        try {

            const pageHeight = 720; // A4 page height in points
            const footerMargin = 30; // Margin from the bottom for footer

            const doc = new PDFDocument();

            const writeStream = fs.createWriteStream(invoicePath);

            doc.pipe(writeStream);

            // Add a company logo
            doc.image(
                path.join(__dirname, '../static/images/logo.png'),
                50,
                50,
                { width: 20 },
            );

            // Add company name and details
            doc.fontSize(16).text('Alkhidmat Europe', 120, 50);
            doc.fontSize(12).text(
                'Address: 123 Business St, City, Country',
                120,
                70,
            );
            doc.text(
                'Email: payments@akeurope.org | Phone: +123456789',
                120,
                85,
            );

            // Draw a separator line
            doc.moveTo(50, 120).lineTo(550, 120).stroke();

            // Add invoice details
            doc.fontSize(16).text('Invoice', 50, 140);
            doc.fontSize(12).text(`Invoice Number: ${order.orderNo}`, 50, 160);
            doc.text(
                `Invoice Date: ${new Date(
                    order.createdAt,
                ).toLocaleDateString()}`,
                50,
                175,
            );

            // Add customer details
            doc.fontSize(16).text(`Billed To:`, 350, 140);
            doc.fontSize(12);
            doc.text(`${order.customer.name}`, 350, 160);
            doc.text(`${order.customer.email}`, 350, 175);
            doc.text(`${order.customer.organization || ''}`, 350, 190);

            // Draw the table starting from a Y position
            const startY = 250;
            const endY = drawTable(doc, order.projects, startY, order);

            // Draw a total price below the table
            doc.fontSize(12).text(
                `Total: ${order.totalCost} in ${order.currency}`,
                350,
                endY + 30,
            );

            // Calculate the available space for the footer
            let footerY = pageHeight - footerMargin;

            // Add "Thank you for your business!" text at the bottom of the page
            doc.fontSize(12).text('Thank you for your business!', 50, footerY, {
                align: 'center',
            });

            // Move the y-position down a bit for the next line
            footerY += 15;

            // Add the second line of text with some margin
            doc.text(
                'If you have any questions, feel free to contact us.',
                50,
                footerY,
                {
                    align: 'center',
                },
            );

            doc.end();

            writeStream.on('finish', () => {
                resolve(invoicePath);
            });

            writeStream.on('error', (err) => {
                console.error(`Error writing file: ${err.message}`);
                reject(err);
            });
        } catch (error) {
            console.error(`Error generating PDF: ${error.message}`);
            reject(error);
        }
    });
};

const drawTable = (doc, projects, startY, order) => {
    let y = startY;

    // Table headers
    doc.fontSize(12).text('Project', 50, y);
    doc.text('Selected\nBeneficiaries', 250, y - 14);
    doc.text('Months', 180, y);
    doc.text(`Total Cost (${order.currency})`, 350, y);
    doc.moveTo(50, y + 20)
        .lineTo(550, y + 20)
        .stroke();

    y += 14;

    // Table rows
    projects.forEach((val) => {
        const project = val.project;
        y += 20;
        doc.fontSize(12).text(project.name, 50, y);
        doc.text(val.entriesCount, 250, y);
        doc.text(project.months, 180, y);
        doc.text(project.totalOrderedCostAllMonths, 350, y);
    });

    return y;
};
