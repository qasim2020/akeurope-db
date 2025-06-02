const { visibleLogs, userLogs } = require('../modules/logAction');
const Beneficiary = require('../models/Beneficiary');
const Project = require('../models/Project');
const User = require('../models/User');
const { createDynamicModel } = require('../models/createDynamicModel');
const Log = require('../models/Log');
const mongoose = require('mongoose');

const getStatusLogsByEntryId = async (entryId) => {
    let allLogs = [];
    const logs = await Log.find({ entityId: entryId, entityType: 'entry', changes: { $exists: true } }).select('changes timestamp actorId').sort({ timestamp: -1 }).lean();
    const statusLogs = logs.map(log => {
        const statusLogFound = log.changes.find(fd => fd.key === 'status');
        if (statusLogFound) {
            return {
                status: statusLogFound.newValue,
                timestamp: log.timestamp,
                actorId: log.actorId,
            };
        } else {
            return null;
        }
    }).filter(log => log !== null);
    if (statusLogs.length > 0) {
        allLogs = statusLogs;
        for (const log of statusLogs) {
            log.actor = await User.findById(log.actorId).lean();
        }
    } else {
        allLogs = [];
    }
    return allLogs;
};

const getEntriesByBenficiaryId = async (beneficiaryId) => {
    const beneficiary = await Beneficiary.findById(beneficiaryId).lean();
    if (!beneficiary) throw new Error(`Beneficiary not found: ${beneficiaryId}`);
    if (!beneficiary.projects || beneficiary.projects.length === 0) {
        throw new Error(`No projects found for beneficiary: ${beneficiary}`);
    }
    let profiles = [];
    for (const slug of beneficiary.projects) {
        let projectEntries = [];
        let entriesFound = [];
        const model = await createDynamicModel(slug);
        const project = await Project.findOne({ slug }).lean();
        if (slug === 'egypt-family') {
            entriesFound = await model.find({ 'uploadedBy.actorId': beneficiary._id.toString() }).lean();
            projectEntries.push(...entriesFound);
        } else {
            const phoneFields = project.fields.filter(field => field.phone === true);
            const queryOr = phoneFields.map(field => ({
                [field.name]: beneficiary.phoneNumber
            }));
            entriesFound = await model.find({
                $or: queryOr
            }).lean();
            projectEntries.push(...entriesFound);
        }
        for (const entry of entriesFound) {
            entry.statusLogs = await getStatusLogsByEntryId(entry._id);
        }
        profiles.push({
            project,
            entries: projectEntries,
        });
    }
    return profiles;
};

module.exports = { getEntriesByBenficiaryId };
