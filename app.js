const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const exphbs = require('express-handlebars');
const mongoose = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const path = require('path');

require('dotenv').config();
mongoose();

const app = express();
app.engine('handlebars', exphbs.engine());
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

// Home route
app.get('/', (req, res) => {
  if (req.session.user) {
    res.render('home', { email: req.session.user.email });
  } else {
    res.redirect('/login');
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
