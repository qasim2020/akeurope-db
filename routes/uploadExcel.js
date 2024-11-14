const express = require('express');
const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure your upload folder
const fs = require('fs');
const moment = require('moment');
const { allProjects, oneProject } = require("../modules/mw-data");
const { authenticate, authorize } = require("../modules/auth");
const { createDynamicModel } = require("../models/createDynamicModel");

router.get("/uploadExcel/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, async (req,res) => {
    res.render( "uploadExcel", {
        layout: "dashboard",
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
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

        // Map column names in header row to column indexes
        const headerRow = worksheet.getRow(1);
        const columnMap = {};
        
        headerRow.eachCell((cell, colNumber) => {
            columnMap[cell.value] = colNumber; // Map header name to column number
        });

        // Using Promise.all to handle async calls within each row processing
        const rowPromises = [];
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header row

            const entryData = {};
            let missingColumns = false;

            project.fields.forEach(field => {
                try {
                    const columnIndex = columnMap[field.name];
                    if (!columnIndex) {
                        throw new Error(`Column for field '${field.name}' not found`);
                    }

                    let cellValue = row.getCell(columnIndex).value;

                    // Handle date parsing
                    if (field.type === 'date' && typeof cellValue === 'string') {
                        // Attempt to parse using multiple date formats
                        const parsedDate = moment(cellValue, [
                            "DD-MM-YYYY", "DD/MM/YYYY", "DD\\MM\\YYYY", 
                            "MM/DD/YYYY", "M/D/YYYY", "D/M/YYYY", 
                            "YYYY-MM-DD", "MM-DD-YYYY", "YYYY/MM/DD", 
                            "YYYYMMDD", "YYYY/M/D"
                        ], true);

                        if (parsedDate.isValid()) {
                            cellValue = parsedDate.toDate();
                        } else {
                            results.errors.push(`Invalid date format in row ${rowNumber} for field '${field.name}': ${cellValue}`);
                            missingColumns = true;
                        }
                    }

                    if (cellValue == null && field.primary) {
                        missingColumns = true;
                        results.errors.push(`Missing primary field: ${field.name} in row ${rowNumber}`);
                    }
                    
                    entryData[field.name] = cellValue;
                    
                } catch (error) {
                    results.errors.push(`Error accessing cell for field '${field.name}' in row ${rowNumber}: ${error.message}`);
                    missingColumns = true;
                }
            });

            // If any required columns are missing, skip this row and log the error
            if (missingColumns) {
                results.errors.push(`Row ${rowNumber} was not saved due to above error.`);
                return;
            }

            // Handle row as a promise to allow async processing
            const rowPromise = DynamicModel.findOne({ [uniqueField]: entryData[uniqueField] })
                .then(existingEntry => {
                    if (existingEntry) {
                        // Update existing entry
                        Object.assign(existingEntry, entryData);
                        return existingEntry.save().then(() => {
                            results.merged++;
                        });
                    } else {
                        // Create new entry
                        const newEntry = new DynamicModel(entryData);
                        return newEntry.save().then(() => {
                            results.createdNew++;
                        });
                    }
                })
                .catch(err => {
                    results.errors.push(`Error in row ${rowNumber}: ${err.message}`);
                });
            
            rowPromises.push(rowPromise);
        });

        // Wait for all row promises to complete before sending response
        await Promise.all(rowPromises);

        res.json({
            message: 'Upload and processing completed',
            results
        });
    } catch (error) {
        console.error('Error processing Excel file:', error);
        res.status(500).send('Error processing Excel file');
    } finally {
        fs.unlinkSync(req.file.path); 
    }
});



module.exports = router;