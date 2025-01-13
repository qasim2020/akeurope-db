const sanitizeHtml = require('sanitize-html');
const mongoose = require('./config/db');
const Log = require('./models/Log'); // Adjust the path to your Log model

async function fixIncompleteHtml() {
    // Fetch logs with incomplete or malformed HTML in `action`
    const logs = await Log.find({}).lean(); // Fetch all logs (can be filtered for specific cases)
    
    for (const log of logs) {
        const originalAction = log.action;
        const sanitizedAction = sanitizeHtml(originalAction, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(['a', 'b', 'i', 'u']),
            allowedAttributes: {
                a: ['href', 'name', 'target'], // Allow specific attributes for `<a>` tags
            },
        });

        if (sanitizedAction !== originalAction) {
            // Update the document if changes were made
            await Log.updateOne({ _id: log._id }, { action: sanitizedAction });
        }
    }
    console.log('HTML sanitization completed.');
}

mongoose();
fixIncompleteHtml().catch(console.error);
