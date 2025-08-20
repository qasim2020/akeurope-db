require('dotenv').config();
const express = require('express');
const http = require('http');
const session = require('express-session');
const flash = require('connect-flash');
const { connectDB } = require('./config/db');
connectDB();

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
const beneficiaryRoutes = require('./routes/beneficiaryRoutes');
const logRoutes = require('./routes/logRoutes');
const orderRoutes = require('./routes/ordersRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const fileRoutes = require('./routes/filesRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const { sendErrorToTelegram } = require('../akeurope-cp/modules/telegramBot');

const app = express();
app.engine('handlebars', exphbs.engine({ helpers: hbsHelpers }));
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


app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const timestamp = new Date().toISOString();
  const country = req.headers['cf-ipcountry'] || 'Unknown';
  console.log(`${timestamp} | ${ip} | ${country} | ${req.originalUrl} `);
  let oldSend = res.send;
  let oldJson = res.json;

  let responseBody;

  res.send = function (data) {
    responseBody = data;
    return oldSend.apply(res, arguments);
  };

  res.json = function (data) {
    responseBody = data;
    return oldJson.apply(res, arguments);
  };

  const forbiddenErrors = ['/overlay/fonts/Karla-regular.woff', '/robots.txt'];

  res.on('finish', () => {
    if (res.statusCode > 399 && !forbiddenErrors.includes(req.originalUrl)) {
      const errorData = {
        message: responseBody,
        status: res.statusCode,
        url: req.originalUrl,
      };

      sendErrorToTelegram(errorData);
    }
  });

  next();
});

app.use(flash());

app.use('/tabler', express.static(path.join(__dirname, 'node_modules', '@tabler', 'core', 'dist')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/robots.txt', express.static(path.join(__dirname, 'static/robots.txt')));

app.use(authRoutes);
app.use(adminRoutes);
app.use(projectRoutes);
app.use(entryRoutes);
app.use(projectsRoutes);
app.use(uploadCloudinary);
app.use(uploadExcel);
app.use(usersRoutes);
app.use(customersRoutes);
app.use(beneficiaryRoutes);
app.use(logRoutes);
app.use(orderRoutes);
app.use(invoiceRoutes);
app.use(fileRoutes);
app.use(whatsappRoutes);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

const defaultIcons = [
  'favicon.ico',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
  'web-app-manifest-512x512.png',
  'apple-touch-icon-120x120-precomposed.png',
  'apple-touch-icon-120x120.png',
];

defaultIcons.forEach((icon) => {
  app.get('/' + icon, (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'favicon', icon));
  });
});

const server = http.createServer(app);
const io = initSocket(server);
app.set('socketio', io);
server.listen('3007', () => {
  console.log(`Server running on http://localhost:3007`);
});

module.exports = router;
