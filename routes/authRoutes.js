const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passwordController = require('../controllers/passwordController');

router.get('/login', (req, res) => res.render('login'));
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/forgot-password', (req, res) => res.render('forgot-password'));
router.post('/forgot-password', passwordController.forgotPassword);
router.get('/reset/:token', passwordController.resetPasswordForm);
router.post('/reset/:token', passwordController.resetPassword);

module.exports = router;