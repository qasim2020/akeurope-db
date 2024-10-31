const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const exphbs = require('express-handlebars');
const mongoose = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const projectRoutes = require('./routes/projectRoutes');
const uploadImage = require('./routes/uploadImage');
const uploadPdf = require('./routes/uploadPdf');
const uploadExcel = require('./routes/uploadExcel');
const updateLayout = require('./routes/updateLayout');
const path = require('path');
const { router } = require('./routes/authRoutes');
const hbsHelpers = require('./modules/helpers');

require('dotenv').config();
mongoose();

const app = express();
app.engine('handlebars', exphbs.engine({helpers: hbsHelpers}));
app.set('view engine', 'handlebars');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());

// Serve static files from the Tabler directory
app.use('/tabler', express.static(path.join(__dirname, 'node_modules', '@tabler', 'core', 'dist')));
// Serve static files from the "public" directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Use authentication routes
app.use(authRoutes);
app.use(adminRoutes);
app.use(projectRoutes);
app.use(uploadImage);
app.use(uploadPdf);
app.use(updateLayout);
app.use(uploadExcel);

// Home route
app.get('/', (req, res) => {
  res.redirect('/login');
});

const PORT = 2007;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));module.exports = router;

