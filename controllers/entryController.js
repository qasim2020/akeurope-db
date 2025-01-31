const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const Customer = require('../models/Customer');
const cloudinary = require('cloudinary').v2;
const moment = require('moment');
const { createDynamicModel } = require('../models/createDynamicModel');
const { projectEntries, fetchEntrySubscriptionsAndPayments, getPaidOrdersByEntryId } = require('../modules/projectEntries');
const { saveLog, visibleLogs, entryLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');
const { createDraftOrder, updateDraftOrder, getPendingOrderEntries, formatOrder } = require('../modules/orders');
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
        project.fields.forEach((field) => {
            const fieldName = field.name;
            let fieldValue = req.body[fieldName];

            if (fieldValue !== undefined) {
                entryData[fieldName] = fieldValue;
            }

            if (field.primary === true) {
                entryData[fieldName] = existingEntry[fieldName];
                fieldValue = existingEntry[fieldName];
            }

            if (field.type === 'date') {
                const formattedExisting = moment(existingEntry[fieldName]).format('YYYY-MM-DD');
                const formattedNew = moment(fieldValue).format('YYYY-MM-DD');

                if (formattedExisting != formattedNew) {
                    entryData[fieldName] = formattedNew;
                }

                existingEntry[fieldName] = formattedExisting;
            } else {
                if (existingEntry[fieldName] != fieldValue) {
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

        res.status(200).send('Entry updated successfully');
    } catch (error) {
        res.status(500).json({
            error: 'Error updating entry',
            details: error.message,
        });
    }
};

exports.deleteEntry = async (req, res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug });
        if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

        const DynamicModel = await createDynamicModel(project.slug);
        const entry = await DynamicModel.findOne({ _id: req.body.entryId });

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

        entry = await fetchEntrySubscriptionsAndPayments(entry);
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
                file.actorName = user.name;
                file.actorRole = user.role;
            }
            if (file.uploadedBy?.actorType === 'customer') {
                file.actorName = (await Customer.findById(file.uploadedBy?.actorId).lean()).name;
            }
        }

        res.render('entry', {
            layout: 'dashboard',
            data: {
                userId: req.session.user._id,
                userName: req.session.user.name,
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
                customers: await Customer.find().lean(),
                payments: await getPaidOrdersByEntryId(req),
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

        res.render('partials/components/paymentModalEntriesInDraftOrder', {
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

        console.log(matches, neighbors);

        res.json({ data: [...matches, ...neighbors] });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error searching entries',
            details: error.message,
        });
    }
};
