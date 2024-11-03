const express = require('express');
const router = express.Router();

router.post('/renderPartial', async (req, res) => {
    try {
        const { partialName, data } = req.body; 

        const validPartials = ['uploadExcelThree'];
        if (!validPartials.includes(partialName)) {
            return res.status(400).send('Invalid partial name');
        }

        res.render(`partials/${partialName}`, { layout: false, data }, (err, html) => {
            if (err) {
                return res.status(500).send('Error rendering partial');
            }
            res.send(html);
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;