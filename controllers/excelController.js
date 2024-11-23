const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const fs = require('fs');
const moment = require('moment');
const { createDynamicModel } = require("../models/createDynamicModel");
const { saveLog, visibleLogs } = require("../modules/logAction");

exports.uploadExcel = async(req,res) => {
    res.render( "uploadExcel", {
        layout: "dashboard",
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
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
                        const changedEntries = Object.entries(updatedFields)
                            .map(
                                ([field, { from, to }]) =>
                                    `<strong>${field}</strong>: "${from || 'null'}" → "${to || 'null'}"`
                            )
                            .join('<br>');
        
                        saveLog({
                            entityType: 'entry',
                            entityId: existingEntry._id,
                            actorType: 'user',
                            actorId: req.session.user._id,
                            url: `/entry/${existingEntry._id}/project/${project.slug}`,
                            action: 'Entry updated',
                            details: `Bulk upload! Entry <strong>${uniqueField}</strong> = <strong>${entryData[uniqueField]}</strong> in project <strong>${project.slug}</strong> updated by <strong>${req.session.user.email}</strong>:<br>${changedEntries}`,
                            color: 'green',
                            isNotification: false,
                        });
        
                        Object.assign(existingEntry, entryData);
                        await existingEntry.save();
                        results.merged++;
                    } else {
                        results.skipped++;
                    }
                } else {
                    const newEntry = new DynamicModel(entryData);
                    await newEntry.save();
                    saveLog({
                        entityType: 'entry',
                        entityId: newEntry._id,
                        actorType: 'user',
                        actorId: req.session.user._id,
                        url: `/entry/${newEntry._id}/project/${project.slug}`,
                        action: 'Entry created',
                        details: `Bulk upload! Entry <strong>${uniqueField}</strong> = <strong>${entryData[uniqueField]}</strong> in project <strong>${project.slug}</strong> created by <strong>${req.session.user.email}</strong>`,
                        color: 'green',
                        isNotification: false,
                    });
                    results.createdNew++;
                }
            })
            .catch((err) => {
                results.errors.push(`Error in row ${rowNumber}: ${err.message}`);
            });
        
            
            rowPromises.push(rowPromise);
        });

        await Promise.all(rowPromises);

        await saveLog({
            actorType: 'user',
            actorId: req.session.user._id,
            action: 'Bulk upload',
            details: `Bulk upload of data in project ${project.name} by <strong>${req.session.user.email}</strong> completed. <br> Created new: ${results.createdNew} <br> Merged: ${results.merged} <br> Skipped: ${results.skipped} <br> Errors: ${results.errors.length}`,
            url: `/project/${project.slug}`,
            color: 'red',
            isNotification: true
        });

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

};