function AvroDoc(schemata) {

    var container = $('#container');

    function ready() {
        Sammy('#container', function () {
            this.get('/', function() {
                var data = {adjective: 'great', schemata: schemata};
                dust.render('index', data, function (err, html) {
                    container.html(html);
                });
            });
        }).run();
    }


    // Load any schemata that were specified by filename. When they are loaded, start up the app.

    var in_progress = 0;

    schemata = _(schemata || []).map(function (schema) {
        if (schema.file) {
            in_progress++;
            $.get(schema.file, function (json) {
                schema.json = json;
                in_progress--;
                if (in_progress === 0) {
                    ready();
                }
            });
        }
    });

    if (in_progress === 0) {
        ready();
    }
}
