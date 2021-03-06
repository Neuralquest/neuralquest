var config = require('./config');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressMongoDb = require('express-mongo-db');
var db = require('./db');
var app = express();
//var cors = require("./enable-cors.js")(app);
app.config = config;
app.db = db;

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    //res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    if ('OPTIONS' == req.method) {
        res.send(200);
    } else {
        next();
    }
});

// Connect to Mongo on start
db.connect(config.mongodb.uri, function(err) {
    if(err) {
        console.log('Unable to connect to Mongo.');
        process.exit(1);
    }
    else console.log('Listening on port 3000...');
});
app.use(expressMongoDb(config.mongodb.uri));// Get database//TODO get rid of
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by');
app.set('port', config.port);
app.use(logger('dev'));//Disable logging for static content requests by loading the logger middleware after the static middleware:

// Configuring Passport
var passport = require('passport');
var expressSession = require('express-session');
//var mongoStore = require('connect-mongo')(session);


app.use(expressSession({secret: config.cryptoKey}));
/*
app.use(expressSession({
    //resave: true,
    saveUninitialized: true,
    secret: config.cryptoKey,
    store: db
    //store: new mongoStore({ url: config.mongodb.uri })
}));
*/
app.use(passport.initialize());
app.use(passport.session());
//app.use(csrf({ cookie: { signed: true } }));

//setup passport
require('./passport')(app, passport);

//setup routes
require('./routes')(app, passport);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found: '+req.url);
    err.status = 404;
    next(err);
});
// error handlers
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        console.log(err.stack);
        res.status(err.status || 500);
        res.type('html');
        res.send('<b>'+err.message+'</b><pre>'+err.stack+'</pre>');
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    console.log(err.stack);
    res.status(err.status || 500);
    res.type('html');
    res.send('<b>'+err.message+'</b>');
});

//listen up
/*
app.server.listen(app.config.port, function(){
    //and... we're live
    console.log('Server is running on port ' + config.port);
});*/
module.exports = app;
