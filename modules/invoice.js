const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const { Error } = require('mongoose');
const { formatDate, formatTime, expiresOn } = require('../modules/helpers');

const generateInvoice = async (order) => {
    const invoiceDir = path.join(__dirname, '../../invoices');
    const invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}.pdf`);

    await fs.ensureDir(invoiceDir);

    return new Promise((resolve, reject) => {
        try {
            const pageHeight = 720; // A4 page height in points
            const footerMargin = 30; // Margin from the bottom for footer

            const doc = new PDFDocument();

            const writeStream = fs.createWriteStream(invoicePath);

            doc.pipe(writeStream);

            // Add a company logo
            doc.image(path.join(__dirname, '../static/images/logo.png'), 50, 50, { width: 20 });

            // Add company name and details
            doc.fontSize(16).text('Alkhidmat Europe', 120, 50);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Address: ', 120, 70, { continued: true })
                .font('Helvetica')
                .text('Grønland 6, 0188, Oslo');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Email: ', 120, 85, { continued: true })
                .font('Helvetica')
                .text('regnskap@akeurope.org | ', { continued: true })
                .font('Helvetica-Bold')
                .text('Phone: ', { continued: true })
                .font('Helvetica')
                .text('+47 40150015');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Organization No: ', 120, 100, { continued: true })
                .font('Helvetica')
                .text('915487440');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Case Manager: ', 120, 115, { continued: true })
                .font('Helvetica')
                .text('Muhammad Sadiq');

            // Draw a separator line
            doc.moveTo(50, 140).lineTo(560, 140).stroke();

            // Add invoice details
            doc.fontSize(16).text('Invoice', 50, 150);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Account Number: ', 50, 170, { continued: true })
                .font('Helvetica')
                .text('22702596711');

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Invoice Number: ', 50, 185, { continued: true })
                .font('Helvetica')
                .text(`${order.orderNo}`);

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Invoice Date: ', 50, 200, { continued: true })
                .font('Helvetica')
                .text(`${formatTime(order.createdAt)}`);

            if (order.monthlySubscription) {
                doc.fontSize(12)
                    .font('Helvetica-Bold')
                    .text('Renewel: ', 50, 215, { continued: true })
                    .font('Helvetica')
                    .text(`${expiresOn(order.createdAt, 1)}`);
            }

            // Add customer details
            doc.fontSize(16).text(`Billed To:`, 350, 150);
            doc.fontSize(12);
            doc.text(`${order.customer.name}`, 350, 170);
            doc.text(`${order.customer.email}`, 350, 185);

            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Organization: ', 350, 200, { continued: true })
                .font('Helvetica')
                .text(`${order.customer.organization || 'Not Listed'}`);

            doc.fontSize(12).font('Helvetica-Bold').text('Address: ', 350, 215);

            doc.fontSize(12)
                .font('Helvetica')
                .text(`${order.customer.location || ''}`, 350, 230);

            const startY = 320;
            const endY = drawTable(doc, order.projects, startY, order);

            doc.moveTo(50, endY + 40)
                .lineTo(560, endY + 40)
                .stroke();

            if (order.monthlySubscription) {
                doc.fontSize(12)
                    .font('Helvetica')
                    .text('Total: ', 350, endY + 60, { continued: true })
                    .font('Helvetica-Bold')
                    .text(`${order.totalCostSingleMonth} ${order.currency}`);
            } else {
                doc.fontSize(12)
                    .font('Helvetica')
                    .text('Total: ', 350, endY + 60, { continued: true })
                    .font('Helvetica-Bold')
                    .text(`${order.totalCost} ${order.currency}`);
            }

            let footerY = pageHeight - footerMargin - 30;

            doc.font('Helvetica');
            doc.fontSize(12).text('Thank you for your business!', 50, footerY, {
                align: 'center',
            });

            footerY += 20;

            doc.text('If you have any questions, feel free to contact us.', 50, footerY, {
                align: 'center',
            });

            footerY += 20;

            doc.fontSize(12).text('regnskap@akeurope.org | +47 40150015', 50, footerY, { align: 'center' });

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
    doc.font('Helvetica-Bold');
    doc.fontSize(12).text('Project', 50, y);
    doc.text('Beneficiaries', 250, y);
    doc.text('Months', 180, y);
    doc.text(`Total Cost (${order.currency})`, 350, y);

    doc.moveTo(50, y + 20)
        .lineTo(560, y + 20)
        .stroke();

    y += 14;

    doc.font('Helvetica');
    if (order.monthlySubscription) {
        projects.forEach((project) => {
            y += 20;
            const nameWidth = 150;
            doc.fontSize(12).text(project.detail.name, 50, y, { width: nameWidth, align: 'left' });
            doc.text(project.entriesCount, 250, y);
            doc.text(1, 180, y);
            doc.text(project.totalCostSingleMonth, 350, y);
        });
    } else {
        projects.forEach((project) => {
            y += 20;
            const nameWidth = 150;
            doc.fontSize(12).text(project.detail.name, 50, y, { width: nameWidth, align: 'left' });
            doc.text(project.entriesCount, 250, y);
            doc.text(project.months, 180, y);
            doc.text(project.totalCostAllMonths, 350, y);
        });
    }

    return y;
};

function deletePath(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`File deleted successfully: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`Error deleting file: ${filePath}`, err);
            return false;
        }
    } else {
        console.log(`File does not exist: ${filePath}`);
        return false;
    }
}

const deleteInvoice = async (orderId) => {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
        throw new Error('Order does not exist');
    }
    const customer = await Customer.findOne({ _id: order.customerId });
    const invoiceDir = path.join(__dirname, '../../invoices');
    const invoicePath = path.join(invoiceDir, `order_no_${order.orderNo}.pdf`);
    return deletePath(invoicePath);
};

const sendInvoiceToCustomer = async (order, customer) => {
    const invoicesDirectory = '../invoices';
    const invoiceFilename = `order_no_${order.orderNo}.pdf`;
    const invoicePath = path.join(invoicesDirectory, invoiceFilename);

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const templatePath = path.join(__dirname, '../views/emails/invoice.handlebars');
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: customer.email,
        subject: `Invoice from Akeurope - ${order.totalCost}`,
        html: compiledTemplate({
            name: customer.name,
        }),
        attachments: [
            {
                filename: invoiceFilename,
                path: invoicePath,
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Invoice sent!');
        return true;
    } catch (err) {
        throw new Error(`Failed to send email: ${err.message}`);
    }
};

module.exports = { generateInvoice, deleteInvoice, deletePath, sendInvoiceToCustomer };
