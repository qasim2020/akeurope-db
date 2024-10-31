const express = require('express');
const router = express.Router();
const { allProjects, oneProject } = require("../modules/mw-data");

router.get("/uploadExcel/:slug", allProjects, oneProject, async (req,res) => {
    res.render( "uploadExcel", {
        layout: "dashboard",
        data: {
            projects: req.allProjects,
            project: req.oneProject,
            activeMenu: req.params.slug
        }
    })
});

router.get("/uploadExcel/step-2/:slug", allProjects, oneProject, async (req,res) => {
    res.render( "uploadExcelTwo", {
        layout: "dashboard",
        data: {
            projects: req.allProjects,
            project: req.oneProject,
            activeMenu: req.params.slug
        }
    })
});

module.exports = router;