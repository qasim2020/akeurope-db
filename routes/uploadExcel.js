const express = require('express');
const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure your upload folder
const fs = require('fs');
const { allProjects, oneProject } = require("../modules/mw-data");
const { authenticate, authorize } = require("../modules/auth");
const { createDynamicModel } = require("../models/createDynamicModel");

router.get("/uploadExcel/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, async (req,res) => {
    res.render( "uploadExcel", {
        layout: "dashboard",
        data: {
            projects: req.allProjects,
            project: req.oneProject,
            activeMenu: req.params.slug
        }
    })
});

router.get("/uploadExcel/step-1/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, async (req,res) => {
  res.render( "partials/uploadExcelOne", {
      layout: false,
      data: {
          projects: req.allProjects,
          project: req.oneProject,
          activeMenu: req.params.slug
      }
  })
});

router.get("/uploadExcel/step-2/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, async (req,res) => {
    res.render( "partials/uploadExcelTwo", {
        layout: false,
        data: {
            projects: req.allProjects,
            project: req.oneProject,
            activeMenu: req.params.slug
        }
    })
});

router.get('/downloadExcelTemplate/:slug', authenticate, authorize("editEntry"), async (req, res) => {
    try {
      const project = await Project.findOne({ slug: req.params.slug }).lean();
      if (!project) return res.status(404).send(`Project ${req.params.slug} not found`);
  
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(project.name);
  
      // Add headers based on project fields
      const headers = project.fields.map(field => ({
        header: field.name,
        key: field.name,
        width: 20
      }));
      worksheet.columns = headers;
  
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${project.name.replace(/\s/g, '_')}_template.xlsx`
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error generating Excel template:', error);
      res.status(500).send('Error generating Excel template');
    }
});

// Route to handle Excel file upload
router.post('/uploadExcel/:slug', authenticate, authorize("editEntry"), upload.single('excelFile'), async (req, res) => {
    try {
      const project = await Project.findOne({ slug: req.params.slug });
      if (!project) return res.status(404).send(`Project ${req.params.slug} not found`);
  
      const DynamicModel = await createDynamicModel(project.slug);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
  
      const worksheet = workbook.getWorksheet(project.name);
      const uniqueField = project.fields.find(field => field.primary)?.name;
  
      if (!uniqueField) return res.status(400).send('Primary (unique) field not found in schema');
  
      const results = {
        merged: 0,
        createdNew: 0,
        errors: []
      };
  
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
  
        const entryData = {};
        let missingColumns = false;
  
        project.fields.forEach(field => {
          const cellValue = row.getCell(field.name).value;
          if (cellValue === null && field.required) {
            missingColumns = true;
          }
          entryData[field.name] = cellValue || undefined;
        });
  
        if (missingColumns) {
          results.errors.push(`Row ${rowNumber} is missing required fields`);
          return;
        }
  
        // Check if an entry with the unique field exists
        DynamicModel.findOne({ [uniqueField]: entryData[uniqueField] })
          .then(existingEntry => {
            if (existingEntry) {
              // Update existing entry
              Object.assign(existingEntry, entryData);
              return existingEntry.save();
            } else {
              // Create new entry
              const newEntry = new DynamicModel(entryData);
              return newEntry.save();
            }
          })
          .then(() => {
            if (existingEntry) {
              results.merged++;
            } else {
              results.createdNew++;
            }
          })
          .catch(err => {
            results.errors.push(`Error in row ${rowNumber}: ${err.message}`);
          });
      });
  
      res.json({
        message: 'Upload and processing completed',
        results
      });
    } catch (error) {
      console.error('Error processing Excel file:', error);
      res.status(500).send('Error processing Excel file');
    } finally {
      fs.unlinkSync(req.file.path); // Delete uploaded file after processing
    }
});

module.exports = router;