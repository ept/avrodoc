function AvroDoc(input_schemata) {

    var _public = {};
    var list_pane = $('#list-pane'), content_pane = $('#content-pane');
    var schema_by_name = {};

    function showType(type) {
        if (!type) {
            content_pane.empty();
        } else {
            dust.render('named_type', type, function (err, html) {
                content_pane.html(html);
            });
        }
    }

    function ready() {
        // Array of schema models
        _public.schemata = _(schema_by_name).values();

        dust.render('schema_list', _public, function (err, html) {
            list_pane.html(html);
        });

        Sammy(function () {
            this.get('/', function () {
                if (_public.schemata.length === 1) {
                    showType(_public.schemata[0].root_type);
                } else {
                    content_pane.empty();
                }
            });

            this.get('/schema/:filename/:qualified_name', function () {
                var schema = schema_by_name[this.params.filename];
                showType(schema && schema.named_types[this.params.qualified_name]);
            });
        }).run();
    }

    function addSchema(json, filename) {
        filename = filename || 'default';

        // If the name is already taken, append a number to make it unique
        if (schema_by_name[filename]) {
            var i = 1;
            while (schema_by_name[filename + i]) i++;
            filename = filename + i;
        }

        schema_by_name[filename] = AvroDoc.Schema(json, filename);
    }


    // Load any schemata that were specified by filename. When they are loaded, start up the app.
    var in_progress = 0;

    input_schemata = input_schemata || [];
    _(input_schemata).each(function (schema) {
        if (schema.filename) {
            in_progress++;
            $.getJSON(schema.filename, function (json) {
                addSchema(json, schema.filename);
                in_progress--;
                if (in_progress === 0) {
                    ready();
                }
            });
        } else if (schema.json) {
            addSchema(schema.json);
        } else {
            throw 'You must specify JSON or a filename for a schema';
        }
    });

    if (in_progress === 0) {
        ready();
    }

    return _public;
}
