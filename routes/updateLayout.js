const express = require('express');
const router = express.Router();

router.post('/update-layout', (req, res) => {
    const newLayout = req.body.layout;
    req.session.layout = newLayout;
    res.json({ message: 'Layout updated', layout: newLayout });
});

module.exports = router;