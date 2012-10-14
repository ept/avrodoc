var express = require('express');
var dust = require('dustjs-linkedin');
require('dustjs-helpers');
var http = require('http');
var path = require('path');
var fs = require('fs');

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
    res.sendfile('./avrodoc.html');
});

app.get('/dust-templates.js', function (req, res, next) {
    // TODO cache compiled templates
    var compiled = '', to_do = 0, template_dir = path.join(__dirname, 'templates');
    fs.readdir(template_dir, function (err, files) {
        if (err) throw err;
        files.forEach(function (file) {
            if (file.match(/\.dust$/)) {
                var file_path = path.join(template_dir, file);
                console.log('Compiling ' + file_path);
                to_do++;
                fs.readFile(file_path, 'utf-8', function (err, template) {
                    if (err) throw err;
                    compiled += dust.compile(template, file.replace(/\.dust$/, ''));
                    to_do--;
                    if (to_do === 0) res.set('Content-Type', 'text/javascript').send(compiled);
                });
            }
        });
    });
});

http.createServer(app).listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});
