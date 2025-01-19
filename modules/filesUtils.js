const File = require('../models/File');

const getEntityFilesById = async (entityId) => {

    const files = await File.find({ 'links.entityId': entityId }).lean();
    return files;

}

module.exports = { getEntityFilesById };