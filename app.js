var express = require('express');
var http = require('http');
var path = require('path');
var content = require('./lib/static_content');

var schemata = [{filename: 'isb.avsc'}]; // FIXME HACK

// Precompile dust templates at app startup, and then serve them out of memory
var dust_templates = content.dustTemplates();

var app = express();

app.configure(function(){
    app.set('port', process.env.PORT || 8124);
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/', function (req, res, next) {
    content.topLevelHTML({schemata: schemata}, function (err, html) {
        res.set('Content-Type', 'text/html').send(html);
    });
});

app.get('/dust-templates.js', function (req, res, next) {
    res.set('Content-Type', 'text/javascript').send(dust_templates);
});

http.createServer(app).listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});
