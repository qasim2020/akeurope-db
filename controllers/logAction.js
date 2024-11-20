const Log = require('../models/Log');

const saveLog = async ({ entityType, entityId, actorType, actorId, action, details, timestamp = new Date(), url, color, isNotification, isRead, expiresAt }) => {
    try {
        const log = new Log({
            entityType,
            entityId,
            actorType,
            actorId,
            action,
            details,
            timestamp,
            url,
            isNotification,
            isRead,
            expiresAt,
            color
        });

        await log.save();
    } catch (error) {
        console.error('Error creating log:', error);
        return error;
    }
};

const updateLog = async ({ logId, updates, }) => {
    try {
        const updatedLog = await Log.findByIdAndUpdate( logId,
            { $set: updates },
            { new: true } 
        );

        if (!updatedLog) {
            console.error('Log not found or update failed.');
            return null;
        }

        console.log('Log updated successfully:', updatedLog);
        return updatedLog;
    } catch (error) {
        console.error('Error updating log:', error);
        return error;
    }
};

const visibleLogs = async ( req, res ) => {
    try {
        const logs = await Log.find({isNotification: true, isRead: false}).sort({timestamp: -1}).lean();
        return logs;
    } catch (error) {
        return error;
    }
}

module.exports = { saveLog, updateLog, visibleLogs }
