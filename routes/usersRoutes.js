const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require("../modules/auth");
const { allProjects } = require("../modules/mw-data");
const usersController = require('../controllers/usersController');

router.get('/users', authenticate, authorize("viewUsers"), allProjects, usersController.users);
router.get('/getUsersData', authenticate, authorize("viewUsers"), usersController.getData);
router.get('/getUserModal/:userId', authenticate, authorize("editUsers"), usersController.editModal);
router.post('/users/create', authenticate, authorize("createUsers"), usersController.createUser);
router.post('/users/update/:userId', authenticate, authorize("updateUsers"), usersController.updateUser);
router.post('/users/delete/:userId', authenticate, authorize("deleteUsers"), usersController.deleteUser);
router.post('/users/sendInvite', authenticate, authorize("editUsers"), usersController.sendInvite);
router.get('/users/register/:token', usersController.register);
router.post('/users/register/:token', usersController.setRegister);

module.exports = router;