const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const User = require('../models/User');
const moment = require('moment');
const nodemailer = require('nodemailer');
const checkValidForm = require("../modules/checkValidForm");
const { saveLog, visibleLogs } = require("../modules/logAction");
const { logTemplates } = require("../modules/logTemplates");

exports.users = async(req,res) => {

    try {
        const users = await User.find().lean();

        res.render('users', { 
            layout: "dashboard", 
            data: {
                userName: req.session.user.name,
                userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                userEmail: req.session.user.email, 
                projects: req.allProjects,
                layout: req.session.layout,
                activeMenu: "users",
                role: req.userPermissions,
                users: users,
                logs: await visibleLogs(req,res)
            }
        });

    } catch (err) {
        res.status(500).send('Error fetching users');
    }

}

exports.getData = async(req,res) => {
    try {
        const users = await User.find().lean();
        
        res.render('partials/showUsers', { 
            layout: false, 
            data: {
            layout: req.session.layout,
            role: req.userPermissions,
            userEmail: req.session.user.email, 
            users,
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching entries partial', details: error.message });
    }
}

exports.editModal = async(req,res) => {
    try {
        let user = await User.findOne({_id: req.params.userId}).lean();
        if (!user) {
        return res.status(400).send("User not found");
        }
        res.render('partials/editUserModal', { layout: false, data: {user} });
    } catch(e) {
        res.status(400).send(e);
    }
}

exports.createUser = async(req,res) => {
    const { name, email, role} = req.body;

    let check = [];

    if (!checkValidForm.isValidEmail(email)) {
        check.push({elem: ".email", msg: "Invalid email"});
    }

    if (!checkValidForm.isValidName(name)) {
        check.push({elem: ".name", msg: "Name contains only letters and spaces and is at least three characters long"});
    }

    if (check.length > 0) {
        res.status(400).send(check);
        return false;
    }

    try {
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();

        const newUser = new User({
        name,
        email,
        role,
        status: "Invite Sent",
        inviteToken,
        inviteExpires,
        });

        let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true, 
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        });

        const templatePath = path.join(__dirname, '../views/emails/userInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Invited to akeurope dashboard',
        html: compiledTemplate({
            name: name,
            inviteLink: `${process.env.URL}/users/register/${inviteToken}`
        }),
        };

        transporter.sendMail(mailOptions, async (err) => {

            if (err) {
                return res.status(400).send(err);
            }

            await newUser.save();
                                
            await saveLog(logTemplates({ 
                type: 'userCreated',
                entity: newUser,
                actor: req.session.user
            }));

            res.status(200).send("Email sent successfully.");

        });

    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
    
}

exports.updateUser = async(req,res) => {
    const { name, role } = req.body;

    let check = [];

    if (!checkValidForm.isValidName(name)) {
        check.push({elem: ".name", msg: "Name contains only letters and spaces and is at least three characters long"});
    }

    let user = await User.find({_id: req.params.userId});

    if (req.session.user.email == user.email && req.session.user.role != role) {
        check.push({msg: "User is currently logged in, therefore role can not be changed!"});
    }

    if (check.length > 0) {
        res.status(400).send(check);
        return false;
    }

    try {
        const updatedFields = { name, role };
        
        const user = await User.findById(req.params.userId); 
        
        let changeDetails = '';
        for (const [key, newValue] of Object.entries(updatedFields)) {
            const oldValue = user[key];
            if (oldValue !== newValue) {
                changeDetails += `<strong>${key}</strong>: ${oldValue ?? 'null'} → ${newValue ?? 'null'}<br>`;
            }
        }
        
        await User.findOneAndUpdate({_id: req.params.userId}, updatedFields);
        
                               
        await saveLog(logTemplates({ 
            type: 'userUpdated',
            entity: user,
            actor: req.session.user,
            changes: changeDetails
        }));

        res.status(200).send("Administrator updated succesfully");
    } catch (e) {
        console.log(e);
        res.status(400).send(e);
    }

}

exports.deleteUser = async(req,res) => {

    if (req.session.user._id == req.params.userId) {
        res.status(400).send("Forbidden: User can't delete himself/ herself!");
        return false;
    }

    try {

        const user = await User.findOne({_id: req.params.userId}).lean();

        await saveLog(logTemplates({ 
            type: 'userDeleted',
            entity: user,
            actor: req.session.user 
        }));

        await User.deleteOne({_id: req.params.userId});
                               
        res.status(200).send("user deleted");
    } catch (e) {
        res.status(400).send(e);
    }

}

exports.register = async(req,res) => {
    try {
        const user = await User.findOne({
            inviteToken: req.params.token,
            inviteExpires: { $gt: new Date() }
        });

        if (!user) {
        return res.status(400).render('error', { heading: "Link Expired!", error: 'Link is invalid or has expired. Please ask the admins to re-send you and invite email!' });
        }

        res.render('register', { name: user.name, email: user.email, token: user.inviteToken });
    } catch (err) {
        res.status(500).send('Error during registration');
    }
}

exports.setRegister = async(req,res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findOne({
            inviteToken: req.params.token,
            inviteExpires: { $gt: new Date() }
        });

        if (!user) {
        return res.status(400).send('Invalid or expired token');
        }

        user.name = name;
        user.password = password;
        user.status = 'Invite Accepted';
        user.inviteToken = undefined;
        user.inviteExpires = undefined;

        await user.save();

                               
        await saveLog(logTemplates({ 
            type: 'userAcceptedInvite',
            entity: user,
            actor: user
        }));

        res.status(200).send("User updated successfully");
    } catch (err) {
        res.status(500).send('Error completing registration');
    }

}

exports.sendInvite = async(req,res) => {
    try {

        const { userId } = req.body;

        if (userId == req.session.user._id) {
        return res.status(400).send("You can not invite yourself!");
        }

        const user = await User.findOne({_id: userId});

        if (!user) {
        return res.status(400).send('User not found');
        }
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = moment().add(24, 'hours').toDate();

        user.status = 'Invite Sent';
        user.inviteToken = inviteToken;
        user.inviteExpires = inviteExpires;

        let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true, 
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        });

        const templatePath = path.join(__dirname, '../views/emails/userInvite.handlebars');
        const templateSource = await fs.readFile(templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateSource);

        const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Invited to akeurope dashboard',
        html: compiledTemplate({
            name: user.name,
            inviteLink: `${process.env.URL}/users/register/${inviteToken}`
        }),
        };

        transporter.sendMail(mailOptions, async (err) => {
            if (err) {
                return res.status(400).send(err);
            }

            await user.save();

            await saveLog(logTemplates({ 
                type: 'sentEmailUserInvite',
                entity: user,
                actor: req.session.user 
            }));

            res.status(200).send("Email sent successfully.");
        });

    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }

}