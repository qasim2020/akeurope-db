const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('./config/db');

const exphbs = require('express-handlebars');
const path = require('path');
const hbsHelpers = require('./modules/helpers');

const MongoStore = require('connect-mongo');

const { router } = require('./routes/authRoutes');
const renderPartial = require('./routes/renderPartial');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const projectRoutes = require('./routes/projectRoutes');
const entryRoutes = require('./routes/entryRoutes');
const projectsRoutes = require('./routes/projectsRoutes');
const usersRoutes = require('./routes/usersRoutes');
const uploadImage = require('./routes/uploadImage');
const uploadPdf = require('./routes/uploadPdf');
const uploadExcel = require('./routes/uploadExcel');
const updateLayout = require('./routes/updateLayout');
const customersRoutes = require('./routes/customersRoutes');

require('dotenv').config();
mongoose();

const app = express();
app.engine('handlebars', exphbs.engine({helpers: hbsHelpers}));
app.set('view engine', 'handlebars');
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Replace with your session secret
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI, // Replace with your MongoDB connection string
      collectionName: 'sessions',      // Optional: customize the collection name
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // Optional: set cookie expiration (1 day)
    }
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
app.use(entryRoutes);
app.use(projectsRoutes);
app.use(uploadImage);
app.use(uploadPdf);
app.use(updateLayout);
app.use(uploadExcel);
app.use(renderPartial);
app.use(usersRoutes);
app.use(customersRoutes);

// Home route
app.get('/', (req, res) => {
  res.redirect('/login');
});

const PORT = 3007;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));module.exports = router;