const { updateLog } = require("../modules/logAction");

exports.clearOne = async(req,res) => {
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
};

// exports.entityType = async(req,res) {
//     // res.render("dashboard")
// }