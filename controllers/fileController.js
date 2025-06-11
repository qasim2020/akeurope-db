const File = require('../models/File');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const { createDynamicModel } = require('../models/createDynamicModel');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Beneficiary = require('../models/Beneficiary');
const Project = require('../models/Project');

const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getChanges } = require('../modules/getChanges');

exports.upload = async (req, res) => {
    try {
        const { links, category, name, path, mimeType } = req.body;
        const file = new File({
            links,
            category,
            name,
            path,
            mimeType,
        });
        await file.save();
        res.status(200).send('File uploaded successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.uploadFileToEntry = async (req, res) => {
    try {
        const fileMulter = req.file;

        if (!fileMulter) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { entityId, entityType, entityUrl, entitySlug, category } = req.body;

        if (!entitySlug) throw new Error('entitySlug is required');

        const access = ['editors', 'customers', 'beneficiary'];

        const links = [
            {
                entityId,
                entityType,
                entityUrl,
            },
            {
                entityId: req.session.user._id,
                entityType: 'user',
                entityUrl: `/user/${req.session.user._id}`,
            },
        ];

        const file = new File({
            links,
            category,
            access,
            name: fileMulter.originalname,
            size: fileMulter.size / 1000,
            path: `/uploads/${fileMulter.filename}`,
            mimeType: fileMulter.mimetype,
            uploadedBy: {
                actorType: 'user',
                actorId: req.session.user._id,
                actorUrl: `/user/${req.session.user._id}`,
            },
        });

        await file.save();

        res.status(200).send(file);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.uploadVideoToEntry = async (req, res) => {
    try {
        const fileMulter = req.file;

        if (!fileMulter) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { entityId, entityType, entityUrl, entitySlug, category } = req.body;

        if (!entitySlug) throw new Error('entitySlug is required');

        const access = ['editors', 'customers', 'beneficiary'];

        const links = [
            {
                entityId,
                entityType,
                entityUrl,
            },
            {
                entityId: req.session.user._id,
                entityType: 'user',
                entityUrl: `/user/${req.session.user._id}`,
            },
        ];

        const file = new File({
            links,
            category,
            access,
            name: fileMulter.originalname,
            size: fileMulter.size / 1000,
            path: `/videos/${fileMulter.filename}`,
            mimeType: fileMulter.mimetype,
            uploadedBy: {
                actorType: 'user',
                actorId: req.session.user._id,
                actorUrl: `/user/${req.session.user._id}`,
            },
        });

        await file.save();

        res.status(200).send(file);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.uploadVideoToOrder = async (req, res) => {
    try {
        const fileMulter = req.file;

        if (!fileMulter) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { entityId, entityType, entityUrl } = req.body;

        if (!entityId || !entityType || !entityUrl) throw new Error('entityId, entityType, entityUrl are required');

        const access = ['customers'];

        const links = [
            {
                entityId,
                entityType,
                entityUrl,
            },
            {
                entityId: req.session.user._id,
                entityType: 'user',
                entityUrl: `/user/${req.session.user._id}`,
            },
        ];

        const file = new File({
            links,
            category: 'general',
            access,
            name: fileMulter.originalname,
            size: fileMulter.size / 1000,
            path: `/videos/${fileMulter.filename}`,
            mimeType: fileMulter.mimetype,
            uploadedBy: {
                actorType: 'user',
                actorId: req.session.user._id,
                actorUrl: `/user/${req.session.user._id}`,
            },
        });

        await file.save();

        res.status(200).send(file);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.uploadFileToOrder = async (req, res) => {
    try {
        const fileMulter = req.file;

        if (!fileMulter) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { entityId, entityType, entityUrl } = req.body;

        if (!entityId || !entityType || !entityUrl) throw new Error('entityId, entityType, entityUrl are required');

        const access = ['customers'];

        const links = [
            {
                entityId,
                entityType,
                entityUrl,
            },
            {
                entityId: req.session.user._id,
                entityType: 'user',
                entityUrl: `/user/${req.session.user._id}`,
            },
        ];

        const file = new File({
            links,
            category: 'general',
            access,
            name: fileMulter.originalname,
            size: fileMulter.size / 1000,
            path: `/uploads/${fileMulter.filename}`,
            mimeType: fileMulter.mimetype,
            uploadedBy: {
                actorType: 'user',
                actorId: req.session.user._id,
                actorUrl: `/user/${req.session.user._id}`,
            },
        });

        await file.save();

        res.status(200).send(file);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.files = async (req, res) => {
    try {
        const sortOption = req.query.sort || 'createdAt';
        const files = await File.find().sort({
            [sortOption]: -1,
        });
        res.status(200).send(files);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.filesByEntity = async (req, res) => {
    try {
        const sortOption = req.query.sort || 'createdAt';
        const files = await File.find({
            'links.entityId': req.params.entityId,
        }).sort({
            [sortOption]: -1,
        });
        res.status(200).send(files);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.renderEntityFiles = async (req, res) => {
    try {
        let files;
        if (req.userPermissions.includes('changeFilesAccess')) {
            files = await File.find({ 'links.entityId': req.params.entityId }).sort({ createdAt: -1 }).lean();
        } else {
            files = await File.find({ 'links.entityId': req.params.entityId, access: 'editors' }).sort({ createdAt: -1 }).lean();
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
            if (file.uploadedBy?.actorType === 'benificiary') {
                file.actorName = (await Beneficiary.findById(file.uploadedBy?.actorId).lean()).phoneNumber;
            }
        }

        res.status(200).render('partials/showEntityFiles', {
            layout: false,
            data: {
                files,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.file = async (req, res) => {
    try {
        let file;
        if (req.userPermissions.includes('changeFilesAccess')) {
            file = await File.findById(req.params.fileId).lean();
        } else {
            file = await File.findOne({ _id: req.params.fileId, access: 'editors' }).lean();
        }

        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        const dir = path.join(__dirname, '../../');
        let filePath = path.join(dir, file.path);

        try {
            await fs.access(filePath);
        } catch (err) {
            console.warn(`File not found at ${filePath}, trying fallback...`);
            filePath = path.join(__dirname, '../../akeurope-forms-uploads', file.path);
            await fs.access(filePath);
        }

        const mimeType = mime.lookup(filePath);

        if (mimeType && mimeType.startsWith('image/')) {
            const imageBuffer = await fs.readFile(filePath);
            const base64Image = imageBuffer.toString('base64');
            const dataUri = `data:${mimeType};base64,${base64Image}`;

            res.send(`
                <html>
                    <head><style>body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f9f9f9}</style></head>
                    <body>
                        <img src="${dataUri}" style="max-width:100%; max-height:100%;" />
                    </body>
                </html>
            `);
        } else {
            res.status(200).sendFile(filePath);
        }
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
};

exports.update = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { name, category, access, notes } = req.body;

        const file = await File.findById(fileId);
        if (!file) return res.status(404).send('File not found');

        if (req.userPermissions.includes('changeFilesAccess')) {
            file.name = name;
            file.category = category;
            file.notes = notes;
            file.access = access;
        } else {
            file.name = name;
            file.category = category;
            file.notes = notes;
        }

        await file.save();
        return res.status(200).send('File updated successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error renaming file');
    }
};

exports.delete = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { entityType, entityId, entitySlug } = req.body;

        if (!entityType || !entityId || !entitySlug) throw new Error('entityType, entityId, entitySlug are required');

        let file;

        if (req.user?.role === 'admin') {
            file = await File.findOneAndDelete({ _id: fileId });
        } else {
            file = await await File.findOneAndDelete({ _id: fileId, access: 'editors' });
        }

        if (!file) return res.status(404).send('File not found');

        const dir = path.join(__dirname, '../../');
        let filePath = path.join(dir, file.path);

        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
        } catch (err) {
            console.warn(`File not found at ${filePath}, trying fallback...`);
            filePath = path.join(__dirname, '../../akeurope-forms-uploads', file.path);
            await fs.access(filePath);
            await fs.unlink(filePath);
        }

        if (entityType === 'order') {
            const order = (await Order.findById(entityId).lean()) || (await Subscription.findById(entityId).lean());
            await saveLog(
                logTemplates({
                    type: 'orderDeletedFile',
                    entity: order,
                    actor: req.session.user,
                    file,
                }),
            );
        } else if (entityType === 'entry') {
            const project = await Project.findOne({ slug: entitySlug }).lean();
            const DynamicModel = await createDynamicModel(entitySlug);
            const entry = await DynamicModel.findById(entityId).lean();
            await saveLog(
                logTemplates({
                    type: 'entryDeletedFile',
                    entity: entry,
                    actor: req.session.user,
                    project,
                    file,
                }),
            );
        }

        res.status(200).send('File deleted successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error deleting file');
    }
};

exports.getFileModal = async (req, res) => {
    try {
        let file;

        if (req.userPermissions.includes('changeFilesAccess')) {
            file = await File.findById(req.params.fileId).lean();
        } else {
            file = await File.findOne({ _id: req.params.fileId, access: 'editors' }).lean();
        }

        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        for (const link of file.links) {
            if (link.entityType === 'entry') {
                const parts = link.entityUrl.split('/');
                const slug = parts[parts.length - 1];
                const model = await createDynamicModel(slug);
                link.entity = await model.findById(link.entityId).lean();
                link.entityName = link.entity && link.entity.name;
            }
            if (link.entityType === 'user') {
                link.entity = await User.findById(link.entityId).lean();
                link.entityName = link.entity && link.entity.name;
            }
            if (link.entityType === 'customer') {
                link.entity = await Customer.findById(link.entityId).lean();
                link.entityName = link.entity && link.entity.name;
            }
            if (link.entityType === 'order') {
                link.entity = await Order.findById(link.entityId).lean();
                link.entityName = `Invoice-${link.entity && link.entity.orderNo}`;
            }
        }

        res.render('partials/editFileModal', {
            layout: false,
            data: {
                file,
                role: req.userPermissions,
            },
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error occured while fetching file modal',
            details: error.message,
        });
    }
};
