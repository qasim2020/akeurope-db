const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forgotPassword } = require('../controllers/forgotPassword');
const { resetPassword } = require('../controllers/resetPassword');
const { resetPasswordForm } = require('../controllers/resetPasswordForm');

// router.get('/register', (req, res) => res.render('register'));
// router.post('/register', authController.register);

router.get('/login', (req, res) => res.render('login'));
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/forgot-password', (req, res) => res.render('forgot-password'));
router.post('/forgot-password', forgotPassword);

// Route to handle password reset form rendering
router.get('/reset/:token', resetPasswordForm);
router.post('/reset/:token', resetPassword);

module.exports = router;