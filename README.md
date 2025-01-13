How to deploy and configure the project on your local machine.
- Pull from git repository

- Install following softwares:
    Node.js https://nodejs.org/en/download
    NPM     https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
            npm install -g npm10.8.2
    Nodemon https://www.npmjs.com/package/nodemon
            npm install -g nodemon
    Mongo   https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/ 

- Verify for all above installations:
    node -v
    npm -v
    mongod -version

- Go to project folder akeurope-db and run this command:
    nodemon akeurope-db.js -e js,hbs,json,handlebars,html,css
    it will provide you local url to run application. In my case it is: http://localhost:3007

- You are all setup and ready to code.  


brew install git node npm mongodb-community@6.0 && brew services restart --all && npm install -g nodemon && brew services start nodemon && mkdir payments invoices && git clone https://github.com/qasim2020/akeurope-db.git && git clone https://github.com/qasim2020/akeurope-cp.git && pm2 start akeurope-db.js -e js,hbs,json,handlebars,html,css && pm2 start akeurope-cp.js -e js,hbs,json,handlebars,html,css