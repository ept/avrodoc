var uglify = require('uglify-js');
var fs = require('fs');
var path = require('path');
var dust = require('dustjs-linkedin');
require('dustjs-helpers');
var less = require('less');
var _ = require('underscore');

// LESS stylesheets required in the browser (relative to public/ directory)
var client_css = [
    'stylesheets/style.less'
];

// JS code required in the browser (relative to public/ directory)
var client_js = [
    'vendor/jquery-1.8.2.js',
    'vendor/underscore-1.4.2.js',
    'vendor/dust-core-1.1.1.js',
    'vendor/dustjs-helpers-1.1.0.js',
    'vendor/sammy-0.7.1.js',
    'js/avrodoc.js',
    'js/schema.js'
];

// Minimal HTML document that holds it all together
var client_html = dust.compileFn([
    '<!DOCTYPE html><html><head>',
    '<title>{title}</title>',
    '<meta charset="UTF-8">',
    '{content|s}',
    '<script type="text/javascript">',
    '   jQuery(function () {',
    '       window.avrodoc = AvroDoc({schemata|s});',
    '   });',
    '</script></head>',
    '<body>',
    '<div id="list-pane"></div><div id="content-pane"></div>',
    '</body></html>'
].join(''));

var template_dir = path.join(__dirname, '..', 'templates');
var public_dir   = path.join(__dirname, '..', 'public');


// Reads a local Javascript file and returns it in minified form.
function minifiedJS(filename) {
    var ast = uglify.parser.parse(fs.readFileSync(filename, 'utf-8'));
    ast = uglify.uglify.ast_mangle(ast);
    ast = uglify.uglify.ast_squeeze(ast);
    return uglify.uglify.gen_code(ast);
}

// Precompiles all templates found in the templates directory, and returns them as a JS string.
function dustTemplates() {
    var compiled = '';
    fs.readdirSync(template_dir).forEach(function (file) {
        if (file.match(/\.dust$/)) {
            var template = fs.readFileSync(path.join(template_dir, file), 'utf-8');
            compiled += dust.compile(template, file.replace(/\.dust$/, ''));
        }
    });
    return compiled;
}

// Compiles LESS stylesheets and returns them as minified CSS.
function stylesheets() {
    var compiled = '';
    client_css.forEach(function (file) {
        if (file.match(/\.less$/)) {
            var style = fs.readFileSync(path.join(public_dir, file), 'utf-8');
            var parser = new(less.Parser)({
                paths: [path.join(public_dir, 'stylesheets')],
                filename: file
            });
            parser.parse(style, function (e, tree) {
                compiled += tree.toCSS({ compress: true }); // Minify CSS output
            });
        }
    });
    return compiled;
}

// Returns HTML containing URL references to all JS and CSS required by the browser.
function remoteContent() {
    var html = [];
    client_css.forEach(function (file) {
        var css_file = file.replace(/\.less$/, '.css');
        html.push('<link rel="stylesheet" type="text/css" href="/' + css_file + '"/>');
    });
    client_js.forEach(function (file) {
        html.push('<script type="text/javascript" src="/' + file + '"></script>');
    });
    html.push('<script type="text/javascript" src="/dust-templates.js"></script>');
    return html.join('\n');
}

// Returns HTML containing all JS and CSS required by the browser inline.
function inlineContent() {
    var html = [];
    html.push('<style type="text/css">');
    html.push(stylesheets());
    html.push('</style>');
    client_js.forEach(function (file) {
        html.push('<script type="text/javascript">');
        html.push(minifiedJS(path.join(public_dir, file)));
        html.push('</script>');
    });
    html.push('<script type="text/javascript">');
    html.push(dustTemplates());
    html.push('</script>');
    return html.join('\n');
}

function topLevelHTML(options, callback) {
    var context = _({
        title: 'Avrodoc',
        content: options.inline ? inlineContent() : remoteContent(),
        schemata: '[]'
    }).extend(options || {});

    if (typeof(context.schemata) !== 'string') {
        context.schemata = JSON.stringify(context.schemata);
    }
    client_html(context, callback);
}

exports.dustTemplates = dustTemplates;
exports.topLevelHTML = topLevelHTML;
