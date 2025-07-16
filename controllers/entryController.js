const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Beneficiary = require('../models/Beneficiary');
const cloudinary = require('cloudinary').v2;
const Sponsorship = require('../models/Sponsorship');
const moment = require('moment');
const { createDynamicModel } = require('../models/createDynamicModel');
const { emailEntryUpdate } = require('../modules/emails');
const {
    projectEntries,
    fetchEntrySubscriptionsAndPayments,
    getPaidOrdersByEntryId,
    getAllOrdersByEntryId,
} = require('../modules/projectEntries');
const { saveLog, visibleLogs, entryLogs, orderLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const { createDraftOrder, updateDraftOrder, getPendingOrderEntries, formatOrder } = require('../modules/orders');
const { sendNotificationToDonor } = require('../modules/notifyCustomer');
const { sendTelegramMessage } = require('../../akeurope-cp/modules/telegramBot')
const { getEntityFiles } = require('../modules/filesUtils.js');
const Order = require('../models/Order');
const File = require('../models/File');

function extractCloudinaryPublicId(url) {
    const parts = url.split('/');
    const publicIdWithExtension = parts.slice(7).join('/').split('.')[0];
    return publicIdWithExtension;
}

exports.editModal = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();

        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        const entry = await DynamicModel.findOne({
            _id: req.params.id,
        }).lean();

        res.render('partials/editEntryModal', {
            layout: false,
            data: {
                project,
                fields: project.fields,
                layout: req.session.layout,
                entry,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    }
};

exports.getData = async (req, res) => {
    try {
        const { entries, project, pagination } = await projectEntries(req, res);

        res.render('partials/showProject', {
            layout: false,
            data: {
                fields: project.fields,
                project,
                entries,
                layout: req.session.layout,
                pagination,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'An error occurred while fetching entries partial',
            details: error.message,
        });
    }
};

exports.createEntry = async (req, res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug });
        if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

        const DynamicModel = await createDynamicModel(project.slug);

        const entryData = {};

        const entryId = req.body.entryId;

        if (!mongoose.Types.ObjectId.isValid(entryId)) {
            return res.status(400).json({ error: 'Invalid entryId provided' });
        }

        entryData._id = entryId;
        project.fields.forEach((field) => {
            const fieldName = field.name;
            const fieldValue = req.body[fieldName];

            if (fieldValue !== undefined) {
                entryData[fieldName] = fieldValue;
            }
        });

        const primaryField = project.fields.find((field) => field.primary == true);

        const newEntry = new DynamicModel(entryData);

        await newEntry.save();

        await saveLog(
            logTemplates({
                type: 'entryCreated',
                entity: newEntry,
                actor: req.session.user,
                project,
            }),
        );

        res.status(201).json({
            message: 'Entry created successfully',
            entry: newEntry,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error saving entry',
            details: error.message,
        });
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug });
        if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

        const DynamicModel = await createDynamicModel(project.slug);

        const entryId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(entryId)) {
            return res.status(400).json({ error: 'Invalid entryId provided' });
        }

        const existingEntry = await DynamicModel.findById(entryId).lean();
        if (!existingEntry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const entryData = {};
        let notifyCustomer = {
            sendEmail: false,
            sendText: false,
            message: '',
        };

        project.fields.forEach((field) => {
            const fieldName = field.name;
            let fieldValue = req.body[fieldName];

            if (fieldValue !== undefined) {
                entryData[fieldName] = fieldValue;
            }

            if (field.status === true && fieldValue?.length > 0) {
                if (!existingEntry.name) {
                    throw new Error('Name field does not exist');
                }
                if (existingEntry[fieldName] != fieldValue) {
                    existingEntry[fieldName] = '';
                    notifyCustomer = {
                        sendEmail: true,
                        sendText: true,
                        email: {
                            subject: 'Orphan Update from Alkhidmat Europe',
                            message: `
Status of a beneficiary that is sponsored by you has been updated: <br>
<b>Beneficiary</b>: ${existingEntry.name.trim()} <br>
<b>Status Update</b>: ${fieldValue} <br>`,
                        },
                        text: `Alkhidmat Europe Update \n\n
Assalam o Alaikum. \n
Status of a beneficiary that is sponsored by you has been updated: \n
Beneficiary: ${existingEntry.name.trim()} \n
Status Update: ${fieldValue} \n
Login here to view beneficiary details. 
${process.env.CUSTOMER_PORTAL_URL} \n
Jazak Allah`,
                    };
                }
            }

            if (field.primary === true) {
                entryData[fieldName] = existingEntry[fieldName];
                fieldValue = existingEntry[fieldName];
            }

            if (field.type === 'date' && fieldValue) {
                const formattedExisting = moment(existingEntry[fieldName]).format('YYYY-MM-DD');
                const formattedNew = moment(fieldValue).format('YYYY-MM-DD');

                if (formattedExisting != formattedNew) {
                    entryData[fieldName] = formattedNew;
                }

                existingEntry[fieldName] = formattedExisting;
            } else {
                if (!fieldValue) {
                    entryData[fieldName] = existingEntry[fieldName];
                } else if (existingEntry[fieldName] != fieldValue) {
                    entryData[fieldName] = fieldValue;
                }
            }
        });

        const changedEntries = getChanges(existingEntry, entryData);

        if (changedEntries.length > 0) {
            await saveLog(
                logTemplates({
                    type: 'entryUpdated',
                    entity: existingEntry,
                    actor: req.session.user,
                    project: project,
                    changes: changedEntries,
                }),
            );

            Object.assign(existingEntry, entryData);

            await DynamicModel.findByIdAndUpdate(existingEntry._id, entryData);
        }

        if (notifyCustomer.sendEmail || notifyCustomer.sendText)
            sendNotificationToDonor(notifyCustomer, existingEntry, req.session.user, project, changedEntries);

        res.status(200).send('Entry updated successfully');

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error updating entry',
            details: error.message,
        });
    }
};

async function canDeleteEntry(entryId) {
    const isReferencedInOrders = await Order.exists({ 'projects.entries.entryId': entryId });
    if (isReferencedInOrders) {
        return false;
    }

    const isReferencedInFiles = await File.exists({ 'links.entityId': entryId });
    if (isReferencedInFiles) {
        return false;
    }

    return true;
}

exports.deleteEntry = async (req, res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug });
        if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

        const DynamicModel = await createDynamicModel(project.slug);
        const entry = await DynamicModel.findOne({ _id: req.body.entryId });

        const canDelete = await canDeleteEntry(entry._id);

        if (!canDelete) {
            throw new Error('Entry cannot be deleted as it is referenced in an Order or File.');
        }

        if (!entry)
            return res.status(404).json({
                error: `Entry with ID ${req.body.entryId} not found!`,
            });

        const deletionPromises = project.fields
            .filter((field) => ['image', 'file'].includes(field.type) && entry[field.name])
            .map((field) => {
                const fileUrl = entry[field.name];

                if (fileUrl.includes('res.cloudinary.com')) {
                    const publicId = extractCloudinaryPublicId(fileUrl);
                    return cloudinary.uploader.destroy(publicId, {
                        resource_type: field.type === 'image' ? 'image' : 'raw',
                    });
                }
            })
            .filter(Boolean);

        const primaryField = project.fields.find((field) => field.primary == true);

        await Promise.all(deletionPromises);

        await DynamicModel.deleteOne({ _id: req.body.entryId });

        await saveLog(
            logTemplates({
                type: 'entryDeleted',
                entity: entry,
                actor: req.session.user,
                project,
            }),
        );

        res.status(200).json({
            message: 'Entry and associated Cloudinary files deleted successfully',
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error deleting entry or associated files',
            details: error.message,
        });
    }
};

const fetchEntryNeighbors = async (model, entry) => {
    const prev =
        (await model
            .findOne({ _id: { $lt: entry._id } })
            .sort({ _id: -1 })
            .lean()) || (await model.findOne().sort({ _id: -1 }).lean());

    const next =
        (await model
            .findOne({ _id: { $gt: entry._id } })
            .sort({ _id: 1 })
            .lean()) || (await model.findOne().sort({ _id: 1 }).lean());

    const prev5 = await model
        .find({ _id: { $lt: entry._id } })
        .sort({ _id: -1 })
        .limit(5)
        .lean();

    const next5 = await model
        .find({ _id: { $gt: entry._id } })
        .sort({ _id: 1 })
        .limit(5)
        .lean();

    const array = [entry, ...next5, ...prev5];

    return {
        prev,
        next,
        array,
    };
};

exports.entry = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        if (!entry) {
            entry = { deleted: true };
        }

        entry.currency = project.currency;

        const neighbors = await fetchEntryNeighbors(DynamicModel, entry);

        let files;

        if (req.userPermissions.includes('changeFilesAccess')) {
            files = await File.find({ 'links.entityId': req.params.entryId }).sort({ createdAt: -1 }).lean();
        } else {
            files = await File.find({ 'links.entityId': req.params.entryId, access: 'editors' }).sort({ createdAt: -1 }).lean();
        }

        for (const file of files) {
            if (file.uploadedBy?.actorType === 'user') {
                const user = await User.findById(file.uploadedBy?.actorId).lean();
                file.actorName = user?.name;
                file.actorRole = user?.role;
            }
            if (file.uploadedBy?.actorType === 'customer') {
                file.actorName = (await Customer.findById(file.uploadedBy?.actorId).lean()).name;
            }
            if (file.uploadedBy?.actorType === 'benificiary') {
                file.actorName = (await Beneficiary.findById(file.uploadedBy?.actorId).lean()).phoneNumber;
            }
        }

        res.render('entry', {
            layout: 'dashboard',
            data: {
                userId: req.session.user._id,
                userName: req.session.user.name,
                userEmail: req.session.user.email,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: project.slug,
                projects: req.allProjects,
                project,
                fields: project.fields,
                layout: req.session.layout,
                entry,
                neighbors,
                files,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                entryLogs: await entryLogs(req, res),
                sidebarCollapsed: req.session.sidebarCollapsed,
                payments: await getAllOrdersByEntryId(req),
                time: Date.now()
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    } 
};
 
exports.entryPrint = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        if (!entry) {
            entry = { deleted: true };
        }

        entry.currency = project.currency;

        const neighbors = await fetchEntryNeighbors(DynamicModel, entry);

        let files;

        if (req.userPermissions.includes('changeFilesAccess')) {
            files = await File.find({ 'links.entityId': req.params.entryId }).sort({ createdAt: -1 }).lean();
        } else {
            files = await File.find({ 'links.entityId': req.params.entryId, access: 'editors' }).sort({ createdAt: -1 }).lean();
        }

        for (const file of files) {
            if (file.uploadedBy?.actorType === 'user') {
                const user = await User.findById(file.uploadedBy?.actorId).lean();
                file.actorName = user?.name;
                file.actorRole = user?.role;
            }
            if (file.uploadedBy?.actorType === 'customer') {
                file.actorName = (await Customer.findById(file.uploadedBy?.actorId).lean()).name;
            }
            if (file.uploadedBy?.actorType === 'benificiary') {
                file.actorName = (await Beneficiary.findById(file.uploadedBy?.actorId).lean()).phoneNumber;
            }
        }

        res.render('partials/showEntryPrint', {
            layout: 'dashboard',
            data: {
                userId: req.session.user._id,
                userName: req.session.user.name,
                userEmail: req.session.user.email,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                activeMenu: project.slug,
                projects: req.allProjects,
                project,
                fields: project.fields,
                layout: req.session.layout,
                entry,
                neighbors,
                files,
                role: req.userPermissions,
                logs: await visibleLogs(req, res),
                entryLogs: await entryLogs(req, res),
                sidebarCollapsed: req.session.sidebarCollapsed,
                payments: await getAllOrdersByEntryId(req),
                time: Date.now()
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error fetching entries',
            details: error.message,
        });
    }
};

exports.getSingleEntryData = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        entry = await fetchEntrySubscriptionsAndPayments(entry);

        res.render('partials/showEntry', {
            layout: false,
            data: {
                fields: project.fields,
                project,
                entry,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'An error occurred while fetching entries partial',
            details: error.message,
        });
    }
};

exports.getSingleEntryLogs = async (req, res) => {
    try {
        const project = await Project.findOne({
            slug: req.params.slug,
        }).lean();
        if (!project) throw new Error(`Project "${req.params.slug}" not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        let entry = await DynamicModel.findOne({
            _id: req.params.entryId,
        }).lean();

        entry = await fetchEntrySubscriptionsAndPayments(entry);
        res.render('partials/showEntryLogs', {
            layout: false,
            data: {
                entryLogs: await entryLogs(req, res),
                project,
                entry,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occured while fetching logs',
            details: error.message,
        });
    }
};

exports.getPaginatedEntriesForDraftOrder = async (req, res) => {
    try {
        if (!req.query.orderId) {
            const orderId = await createDraftOrder(req, res);
            req.query.orderId = orderId;
        } else {
            await updateDraftOrder(req, res);
        }

        const orderInDb = await Order.findOne({
            _id: req.query.orderId,
        }).lean();
        const order = await formatOrder(req, orderInDb);
        const project = order.projects.find((project) => project.slug == req.params.slug);
        if (project) {
            Object.assign(project, {
                detail: await Project.findOne({ slug: project.slug }).lean(),
            });
        }
        const partial =
            order.status === 'draft'
                ? 'partials/components/paymentModalEntriesInDraftOrder'
                : 'partials/components/paymentModalEntriesInLockedOrder';
        res.render(partial, {
            layout: false,
            project,
            order,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated order',
            details: error.message,
        });
    }
};

exports.getPaginatedEntriesForOrderPage = async (req, res) => {
    try {
        const orderInDb = await Order.findOne({
            _id: req.query.orderId,
        }).lean();
        const order = await formatOrder(req, orderInDb);
        const project = order.projects.find((project) => project.slug == req.params.slug);
        if (project) {
            Object.assign(project, {
                detail: await Project.findOne({ slug: project.slug }).lean(),
            });
        }

        order.projects = [project];

        res.render('partials/showOrderEntries', {
            layout: false,
            data: {
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

exports.getPaginatedEntriesForPendingOrder = async (req, res) => {
    try {
        const { order, project } = await getPendingOrderEntries(req, res);
        res.render('partials/components/paymentModalEntriesInPendingOrder', {
            layout: false,
            order,
            project,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated entries',
            details: error.message,
        });
    }
};

exports.getPaginatedEntriesForModal = async (req, res) => {
    try {
        const orderInDb = await Order.findOne({
            _id: req.query.orderId,
        }).lean();
        const order = await formatOrder(req, orderInDb);
        const project = order.projects.find((project) => project.slug == req.params.slug);
        if (project) {
            Object.assign(project, {
                detail: await Project.findOne({ slug: project.slug }).lean(),
            });
        }
        const partial =
            order.status === 'draft'
                ? 'partials/components/paymentModalEntriesInDraftOrder'
                : 'partials/components/paymentModalEntriesInLockedOrder';
        res.render(partial, {
            layout: false,
            project,
            order,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paginated entries',
            details: error.message,
        });
    }
};

exports.getSingleEntryPayments = async (req, res) => {
    try {
        return await getPaidOrdersByEntryId(req);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error getting paid entries',
            details: error.message,
        });
    }
};

exports.searchEntry = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ data: [] });
        }
        const regex = new RegExp(query, 'i');

        const DynamicModel = await createDynamicModel(req.params.slug);

        const matches = await DynamicModel.find({ name: regex }).limit(5).lean();

        let neighbors = [];

        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1].name;
            neighbors = await DynamicModel.find({ name: { $gt: lastMatch } })
                .limit(5)
                .lean();
        }

        res.json({ data: [...matches, ...neighbors] });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error searching entries',
            details: error.message,
        });
    }
};

exports.sendEntryUpdateOnEmail = async (req, res) => {
    try {
        const { entryId, slug } = req.params;
        const model = await createDynamicModel(slug);
        const entry = await model.findById(entryId).lean();
        const order = await Order.findOne({
            status: 'paid',
            'projects.entries.entryId': entry._id
        });
        if (!order) throw new Error(`${entry.name} has no orders`);
        const customer = await Customer.findById(order.customerId).lean();
        const { subject, salute, message, files } = req.body;
        if (!subject || !message || !salute) {
            return res.status(400).send('Subject, salute & message are required');
        }
        if (!customer) {
            return res.status(404).send('Customer not found');
        }
        await emailEntryUpdate(customer.email, salute, subject, message, entry._id, files, entry);
        await sendTelegramMessage(`Email sent to ${customer.name} | ${customer.email} \n\n ${message}`);
        const project = await Project.findOne({ slug }).lean();

        const statusLog = [{
            key: 'status',
            oldValue: '',
            newValue: message
        }];

        await saveLog(
            logTemplates({
                type: 'entryUpdated',
                entity: entry,
                project,
                changes: statusLog,
                order,
                message,
                actor: req.session.user,
            })
        );

        await saveLog(
            logTemplates({
                type: 'donorEntryUpdated',
                entity: customer,
                entry,
                project,
                changes: statusLog,
                actor: req.session.user,
            }),
        );

        res.status(200).send('Entry update sent successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message || 'An error occurred while sending the order update');
    }
}

exports.getSendUpdateModal = async (req, res) => {
    try {
        const { entryId, slug } = req.params;
        const model = await createDynamicModel(slug);
        const entry = await model.findById(entryId).lean();
        const orders = await Order.find({
            status: 'paid',
            'projects.entries.entryId': entry._id
        });
        if (orders.length > 1) throw new Error(`${entry.name} has more than 1 paid orders - impossible - please resolve`);
        if (orders.length === 0) throw new Error(`${entry.name} has zero active orders.`);
        if (!orders) throw new Error(`${entry.name} has no orders`);
        const order = orders[0];
        const customer = await Customer.findById(order.customerId).lean();
        const files = await File.find({ 'links.entityId': entry._id }).sort({ createdAt: -1 }).lean();
        const project = await Project.findOne({ slug }).lean();
        res.render('partials/sendUpdateModalEntry', {
            layout: false,
            data: {
                entry,
                project,
                order,
                customer,
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

exports.stopSponsorship = async (req, res) => {
  try {
    const { orderId, entryId, slug } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).send('Reason is required');
    }
    
    const order = await Order.findById(orderId).populate('customerId');
    if (!order) {
      return res.status(404).send('Order not found');
    }
    
    const project = await Project.findOne({ slug }).lean();
    const DynamicModel = await createDynamicModel(slug);
    const entry = await DynamicModel.findById(entryId).lean();
    
    const orderProject = order.projects.find(p => p.slug === slug);
    const orderEntry = orderProject?.entries.find(e => e.entryId.toString() === entryId);
    
    if (!orderProject || !orderEntry) {
      return res.status(404).send('Entry not found in order');
    }
    
    const startDate = new Date(order.createdAt);
    const stopDate = new Date();
    const daysSponsored = Math.ceil((stopDate - startDate) / (1000 * 60 * 60 * 24));
    
    const dailyRate = orderEntry.totalCost / 30;
    const actualAmountPaid = dailyRate * daysSponsored;
    
    const sponsorship = new Sponsorship({
      entryId: new mongoose.Types.ObjectId(entryId),
      customerId: order.customerId._id,
      projectSlug: slug,
      startedAt: order.createdAt,
      stoppedAt: stopDate,
      reasonStopped: reason,
      daysSponsored: daysSponsored,
      totalPaid: actualAmountPaid
    });
    
    await sponsorship.save();
    
    const orderExpiryDate = new Date(order.createdAt);
    orderExpiryDate.setMonth(orderExpiryDate.getMonth() + 12);
    orderExpiryDate.setDate(orderExpiryDate.getDate() + 10);
    
    const occupiedEntryIds = await Order.distinct('projects.entries.entryId', {
      'projects.slug': slug,
      status: { $in: ['paid', 'draft', 'aborted', 'pending payment', 'processing'] }
    });
    
    const endedSponsorshipEntryIds = await Sponsorship.distinct('entryId', {
      projectSlug: slug,
      stoppedAt: { $exists: true }
    });
    
    const unavailableEntryIds = [
      ...occupiedEntryIds.map(id => id.toString()),
      ...endedSponsorshipEntryIds.map(id => id.toString()),
      entryId 
    ];
    
    const replacementEntry = await DynamicModel.findOne({
      _id: { $nin: unavailableEntryIds.map(id => new mongoose.Types.ObjectId(id)) },
    }).lean();
    
    console.log(`Looking for replacement entry with cost: ${orderEntry.totalCost}`);
    console.log(`Order expiry date: ${orderExpiryDate}`);
    console.log(`Unavailable entries count: ${unavailableEntryIds.length}`);
    console.log(`Replacement entry found: ${replacementEntry ? replacementEntry._id : 'None'}`);
    
    if (replacementEntry) {
      await Order.updateOne(
        { 
          _id: orderId,
          'projects.slug': slug,
          'projects.entries.entryId': new mongoose.Types.ObjectId(entryId)
        },
        { 
          $set: { 
            'projects.$.entries.$[entry].entryId': replacementEntry._id 
          }
        },
        { 
          arrayFilters: [{ 'entry.entryId': new mongoose.Types.ObjectId(entryId) }] 
        }
      );
      
      await saveLog(
        logTemplates({
          type: 'entryReplaced',
          entity: entry,
          actor: req.session.user,
          project,
          entry,
          changes: [{
            key: 'replacement',
            oldValue: entry.name || entry._id,
            newValue: replacementEntry.name || replacementEntry._id
          }, {
            key: 'replacementReason',
            oldValue: '',
            newValue: `Sponsorship stopped: ${reason}`
          }, {
            key: 'replacementCost',
            oldValue: '',
            newValue: orderEntry.totalCost.toString()
          }],
          message: `Entry replaced with ${replacementEntry.name || replacementEntry._id} due to sponsorship stop. Same cost: ${orderEntry.totalCost}`
        })
      );
      
      console.log(`Successfully replaced entry ${entryId} with ${replacementEntry._id} in order ${orderId}`);
      
    } else {
      await saveLog(
        logTemplates({
          type: 'noReplacementFound',
          entity: entry,
          actor: req.session.user,
          project,
          entry,
          changes: [{
            key: 'replacement',
            oldValue: entry.name || entry._id,
            newValue: 'No replacement available'
          }, {
            key: 'searchCriteria',
            oldValue: '',
            newValue: `Cost: ${orderEntry.totalCost}, Expiry: ${orderExpiryDate.toISOString()}`
          }],
          message: `No replacement entry found for stopped sponsorship. Searched for cost: ${orderEntry.totalCost}, before expiry: ${orderExpiryDate}`
        })
      );
      
      console.log(`No replacement entry found for cost: ${orderEntry.totalCost}`);
    }
    
    await saveLog(
      logTemplates({
        type: 'sponsorshipStopped',
        entity: entry,
        actor: req.session.user,
        project,
        entry,
        changes: [{
          key: 'sponsorship',
          oldValue: 'Active',
          newValue: `Stopped: ${reason}`
        }, {
          key: 'daysSponsored',
          oldValue: '',
          newValue: daysSponsored.toString()
        }, {
          key: 'dailyRate',
          oldValue: '',
          newValue: dailyRate.toFixed(2)
        }, {
          key: 'amountPaid',
          oldValue: '',
          newValue: actualAmountPaid.toString()
        }, {
          key: 'orderExpiry',
          oldValue: '',
          newValue: orderExpiryDate.toISOString()
        }]
      })
    );
    
    const responseMessage = replacementEntry 
      ? `Sponsorship stopped successfully. Entry replaced with ${replacementEntry.name || replacementEntry._id}`
      : 'Sponsorship stopped successfully. No replacement entry found.';
    
    res.status(200).send(responseMessage);
    
  } catch (error) {
    console.log('Error in stopSponsorship:', error);
    res.status(500).send(error.message || 'Error stopping sponsorship');
  }
};

exports.getSponsorshipModal = async (req, res) => {
    try {
        const { entryId, slug } = req.params;
        const model = await createDynamicModel(slug);
        const entry = await model.findById(entryId).lean();
        const project = await Project.findOne({ slug }).lean();
        const orders = await Order.find({
            status: 'paid',
            'projects.entries.entryId': entry._id
        }).populate('customerId', 'name email phoneNumber').lean();
        for (const order of orders) {
            for (const project of order.projects) {
                for (const orderEntry of project.entries) {
                    if (orderEntry.entryId.toString() === entry._id.toString()) {
                        order.project = project;
                        orderEntry.months = project.months;
                        orderEntry.perMonthCost = orderEntry.totalCost;
                        order.entry = orderEntry;
                    }
                }
            }
        }
        res.render('partials/sponsorshipModal', {
            layout: false,
            data: {
                entry,
                project,
                orders
            },
        });
    } catch (error) {
        console.log(error);
        res.status(404).send(error.message || 'Error! Check Logs.')
    }
}