const File = require('../models/File');
const fs = require('fs').promises;
const path = require('path');
const { createDynamicModel } = require('../models/createDynamicModel');
const User = require('../models/User');
const Customer = require('../models/Customer');

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

        const { entityId, entityType, entityUrl, category } = req.body;

        let access;
        
        if (req.userPermissions.includes('changeFilesAccess')) {
            access = ['editors'];
        } else {
            access = ['editors', 'customers'];
        }
        

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
            name: fileMulter.filename,
            size: fileMulter.size / 1000,
            path: `/uploads/${fileMulter.filename}`,
            mimeType: fileMulter.mimetype,
        });

        console.log(file);

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
            files = await File.find({ 'links.entityId': req.params.entityId }).sort({ uploadDate: -1 }).lean();
        } else {
            files = await File.find({ 'links.entityId': req.params.entityId, access: 'editors' }).sort({ uploadDate: -1 }).lean();
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
        if (req.user?.role === 'admin') {
            file = await File.findById(req.params.fileId).lean();
        } else {
            file = await File.findOne({ _id: req.params.fileId, access: 'editors' }).lean();
        }

        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        const dir = path.join(__dirname, '../../');
        const filePath = path.join(dir, file.path);

        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send({ error: 'Failed to send file' });
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.update = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { name, category, access } = req.body;
        const file = await File.findById(fileId);
        if (!file) return res.status(404).send('File not found');

        if (req.userPermissions.includes('changeFilesAccess')) {
            file.name = name;
            file.category = category;
            file.access = access;
        } else {
            file.name = name;
            file.category = category;
            file.access = ['editors', 'customers'];
        }

        await file.save();

        res.status(200).send('File renamed successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error renaming file');
    }
};

exports.delete = async (req, res) => {
    try {
        const { fileId } = req.params;
        
        let file;

        if (req.user?.role === 'admin') {
            file = await File.findOneAndDelete({ _id: fileId });
        } else {
            file = await await File.findOneAndDelete({ _id: fileId, access: 'editors' });
        } 

        if (!file) return res.status(404).send('File not found');

        const dir = path.join(__dirname, '../../');
        const filePath = path.join(dir, file.path);
        await fs.unlink(filePath);

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
            file = await File.findOne({_id: req.params.fileId, access: 'editors'}).lean();
        }  

        if (!file) {
            return res.status(404).send({ error: 'File not found' });
        }

        for (const link of file.links) {
            if (link.entityType === 'entry') {
                link.entity = await Customer.findById(link.entityId).lean();
                const parts = link.entityUrl.split('/');
                const slug = parts[parts.length - 1];
                const model = await createDynamicModel(slug);
                link.entity = await model.findById(link.entityId).lean();
                link.entityName = link.entity.name;
            }
            if (link.entityType === 'user') {
                link.entity = await User.findById(link.entityId).lean();
                link.entityName = link.entity.name;
            }
            if (link.entityType === 'customer') {
                link.entity = await Customer.findById(link.entityId).lean();
                link.entityName = link.entity.name;
            }
        }

        res.render('partials/editFileModal', {
            layout: false,
            data: {
                file,
                role: req.userPermissions
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occured while fetching file modal',
            details: error.message,
        });
    }
};
