require('dotenv').config();

const express = require('express');
const http = require('http');
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('./config/db');

const exphbs = require('express-handlebars');
const path = require('path');
const hbsHelpers = require('./modules/helpers');

const MongoStore = require('connect-mongo');

const { initSocket } = require('./sockets');

const { router } = require('./routes/authRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const projectRoutes = require('./routes/projectRoutes');
const entryRoutes = require('./routes/entryRoutes');
const projectsRoutes = require('./routes/projectsRoutes');
const usersRoutes = require('./routes/usersRoutes');
const uploadCloudinary = require('./routes/uploadCloudinary');
const uploadExcel = require('./routes/uploadExcel');
const customersRoutes = require('./routes/customersRoutes');
const logRoutes = require('./routes/logRoutes');
const orderRoutes = require('./routes/ordersRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const fileRoutes = require('./routes/filesRoutes');

mongoose();

const app = express();
app.engine('handlebars', exphbs.engine({helpers: hbsHelpers}));
app.set('view engine', 'handlebars');
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(
  session({
    name: 'akeurope-db-id',
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI, 
      collectionName: 'sessions',      
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, 
    }
  })
);

app.use(flash());

app.use('/tabler', express.static(path.join(__dirname, 'node_modules', '@tabler', 'core', 'dist')));
app.use('/static', express.static(path.join(__dirname, 'static')));

app.use(authRoutes);
app.use(adminRoutes);
app.use(projectRoutes);
app.use(entryRoutes);
app.use(projectsRoutes);
app.use(uploadCloudinary);
app.use(uploadExcel);
app.use(usersRoutes);
app.use(customersRoutes);
app.use(logRoutes);
app.use(orderRoutes);
app.use(invoiceRoutes);
app.use(fileRoutes);


app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

const server = http.createServer(app);
const io = initSocket(server);
app.set('socketio', io);
server.listen('3007', () => {
  console.log(`Server running on http://localhost:3007`);
});

module.exports = router;
