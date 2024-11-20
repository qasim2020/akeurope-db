const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { updateLog } = require("../controllers/logAction");

router.post("/clearNotification/:logId", authenticate, authorize("editNotifications"), async (req,res) => {
    try {
        await updateLog({ logId: req.params.logId, updates: { isRead: true } });
        res.status(200).send("Log cleared");
    } catch(err) {
        console.log(err);
        res.status(400).send({
            success: false,
            message: err.message || "Failed to clear notification",
        });
    }
});

module.exports = router;