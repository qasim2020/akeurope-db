const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const fs = require('fs');
const moment = require('moment');
const { createDynamicModel } = require("../models/createDynamicModel");
const { saveLog, visibleLogs } = require("../modules/logAction");
const { logTemplates } = require("../modules/logTemplates");
const { getChanges } = require("../modules/getChanges");

exports.uploadExcel = async(req,res) => {
    res.render( "uploadExcel", {
        layout: "dashboard",
        data: {
            userId: req.session.user._id,
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            role: req.userPermissions,
            sidebarCollapsed: req.session.sidebarCollapsed,
            projects: req.allProjects,
            project: req.oneProject,
            activeMenu: req.params.slug,
            logs: await visibleLogs(req,res)
        }
    })
};

exports.stepOne = async(req,res) => {
  res.render( "partials/uploadExcelOne", {
      layout: false,
      data: {
          projects: req.allProjects,
          project: req.oneProject,
          activeMenu: req.params.slug
      }
  })
}

exports.stepTwo = async(req,res) => {
    res.render( "partials/uploadExcelTwo", {
        layout: false,
        data: {
            projects: req.allProjects,
            project: req.oneProject,
            activeMenu: req.params.slug
        }
    })
}

exports.template = async(req,res) => {
    try {
        const project = await Project.findOne({ slug: req.params.slug }).lean();
        if (!project) return res.status(404).send(`Project ${req.params.slug} not found`);
    
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(project.name);
    
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
}

exports.upload = async(req,res) => {
    try {
        let merged = [];
        const project = await Project.findOne({ slug: req.params.slug });
        if (!project) return res.status(404).send(`Project ${req.params.slug} not found`);

        const DynamicModel = await createDynamicModel(project.slug);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const worksheet = workbook.worksheets[0];
        const uniqueField = project.fields.find(field => field.primary)?.name;

        if (!uniqueField) return res.status(400).send('Primary (unique) field not found in schema');

        const results = {
            merged: 0,
            createdNew: 0,
            skipped: 0,
            errors: []
        };

        const headerRow = worksheet.getRow(1);
        const columnMap = {};
        
        headerRow.eachCell((cell, colNumber) => {
            columnMap[cell.value] = colNumber; 
        });

        const rowPromises = [];
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; 

            const entryData = {};
            let missingColumns = false;

            project.fields.forEach(field => {
                try {
                    const columnIndex = columnMap[field.name];

                    if (!columnIndex) {
                        throw new Error(`Column for field '${field.name}' not found`);
                    }

                    let cellValue = row.getCell(columnIndex).value;

                    if (field.type === 'date' && typeof cellValue === 'string') {

                        const parsedDate = moment(cellValue, [
                            "DD-MM-YYYY", "DD/MM/YYYY", "DD\\MM\\YYYY", 
                            "MM/DD/YYYY", "M/D/YYYY", "D/M/YYYY", 
                            "YYYY-MM-DD", "MM-DD-YYYY", "YYYY/MM/DD", 
                            "YYYYMMDD", "YYYY/M/D", moment.ISO_8601
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

                    if (typeof cellValue === 'object' && cellValue !== null) {
                        if ('result' in cellValue) {
                            cellValue = cellValue.result;
                        } 
                    }
                    
                    entryData[field.name] = cellValue;
                    
                } catch (error) {
                    results.errors.push(`Error accessing cell for field '${field.name}' in row ${rowNumber}: ${error.message}`);
                    missingColumns = true;
                }
            });

            if (missingColumns) {
                results.errors.push(`Row ${rowNumber} was not saved due to above error.`);
                return;
            }

            const rowPromise = DynamicModel.findOne({ [uniqueField]: entryData[uniqueField] })
            .then(async (existingEntry) => {
                if (existingEntry) {

                    const updatedFields = {};

                    for (const key in entryData) {
                        if (entryData[key] !== undefined) {
                            if (project.fields.some(field => field.name === key && field.type === 'date')) {
                                const existingValue = moment(existingEntry[key]).format('YYYY-MM-DD');
                                const newValue = moment(entryData[key]).format('YYYY-MM-DD');

                                if (existingValue !== newValue) {
                                    updatedFields[key] = {
                                        from: existingValue,
                                        to: newValue,
                                    };
                                }
                            } else if (existingEntry[key] != entryData[key]) {
                                updatedFields[key] = {
                                    from: existingEntry[key],
                                    to: entryData[key],
                                };
                            }
                        }
                    }

                    if (Object.keys(updatedFields).length > 0) {
                        
                        saveLog(logTemplates({ 
                            type: 'entryUpdatedBulkUpload',
                            entity: existingEntry,
                            actor: req.session.user,
                            project,
                            changes: getChanges(existingEntry, entryData)
                        })); 
                        
                        const diff = getChanges(existingEntry, entryData);
                        merged.push(diff);

                        Object.assign(existingEntry, entryData);
                        await existingEntry.save();
                        results.merged++;
                        
                    } else {
                        results.skipped++;
                    }
                } else {
                    const newEntry = new DynamicModel(entryData);
                    await newEntry.save();
                                           
                    await saveLog(logTemplates({ 
                        type: 'entryCreatedBulkUpload',
                        entity: newEntry,
                        project,
                        actor: req.session.user 
                    }));

                    results.createdNew++;
                }
            })
            .catch((err) => {
                console.log(err);
                results.errors.push(`Error in row ${rowNumber}: ${err.message}`);
            });
            
            rowPromises.push(rowPromise);
        });

        await Promise.all(rowPromises);

        await saveLog(logTemplates({ 
            type: 'bulkUploadCompleted',
            entity: project,
            actor: req.session.user 
        }));

        res.json({
            message: 'Upload and processing completed',
            merged,
            results
        });
    } catch (error) {
        console.error('Error processing Excel file:', error);
        res.status(500).send('Error processing Excel file');
    } finally {
        fs.unlinkSync(req.file.path); 
    }

};