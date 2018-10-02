/*jshint node:true */

var express = require('express');
var http = require('http');
var path = require('path');
var glob = require('glob');
var fs = require('fs');
var content = require('./lib/static_content');

var schema_dir = path.resolve(process.cwd(), process.env.SCHEMA_DIR || 'schemata');
var schemata = [];
glob('**/*.avsc', {cwd: schema_dir}, function (err, files) {
    if (err) throw err;
    files.sort().forEach(function (file) {
        schemata.push({filename: '/schemata/' + file});
    });
});

// Precompile dust templates at app startup, and then serve them out of memory
var dust_templates = content.dustTemplates();

var app = express();

app.configure(function () {
    app.set('port', process.env.PORT || 8124);
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/', function (req, res) {
    content.topLevelHTML({schemata: schemata}, function (err, html) {
        res.set('Content-Type', 'text/html').send(html);
    });
});

app.get('/dust-templates.js', function (req, res) {
    res.set('Content-Type', 'text/javascript').send(dust_templates);
});

app.get(/^\/schemata\/(\w[\w.\-]*(?:\/\w[\w.\-]*)*)$/, function (req, res) {
    fs.readFile(path.join(schema_dir, req.params[0]), 'utf-8', function (err, data) {
        if (err) {
            res.status(404).send('Not found');
        } else {
            res.set('Content-Type', 'application/json').send(data);
        }
    });
});

var server = http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

var signals = {
    'SIGINT': 2,
    'SIGTERM': 15
};

function shutdown(signal, value) {
    server.close(function () {
        console.log('Express server stopped by ' + signal);
        process.exit(128 + value);
    });
}

Object.keys(signals).forEach(function (signal) {
    process.on(signal, function () {
        shutdown(signal, signals[signal]);
    });
});