const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', (req, res) => res.render('register'));
router.post('/register', authController.register);
router.get('/login', (req, res) => res.render('login'));
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/forgot-password', (req, res) => res.render('forgot-password'));
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
