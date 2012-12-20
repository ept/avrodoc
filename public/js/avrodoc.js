// If foo contains markdown, {foo|md|s} renders it to HTML in a Dust template
dust.filters.md = function (value) {
    return markdown.toHTML(value);
};

function AvroDoc(input_schemata) {

    var _public = {};
    var list_pane = $('#list-pane'), content_pane = $('#content-pane');
    var schema_by_name = {};
    var shared_types = {};
    var current_root_namespace = "";

    // popover_by_name[filename][qualified_name] = {title: 'html', content: 'html'}
    var popover_by_name = {};

    // Render all the popovers ahead of time, because Dust's rendering is async but the popover
    // plugin expects to receive the popover content synchronously when it is triggered.
    function renderPopovers() {
        _(schema_by_name).each(function (schema, filename) {
            popover_by_name[filename] = {};
            _(schema.named_types).each(function (type, qualified_name) {
                var popover = popover_by_name[filename][qualified_name] = {};

                // Do the actual rendering in the background, to keep the page responsive
                window.setTimeout(function () {
                    dust.render('popover_title', type, function (err, html) {
                        popover.title = html;
                    });
                    dust.render('named_type_details', type, function (err, html) {
                        popover.content = html;
                    });
                }, 100);
            });
        });
    }

    // Configures all links to types in the current content pane to show popovers on hover.
    function setupPopovers() {
        content_pane.find('a[href^="#/schema/"]').each(function () {
            var url_segments = $(this).attr('href').split('/');
            var schema_popovers = popover_by_name[decodeURIComponent(url_segments[2])];
            if (!schema_popovers) return;
            var popover = schema_popovers[decodeURIComponent(url_segments[3])];
            if (!popover) return;

            $(this).popover({
                trigger: 'hover',
                placement: 'bottom',
                title: function () { return popover.title; },
                content: function () { return popover.content; },
                delay: {show: 200, hide: 50},
                template: '<div class="popover avrodoc-named-type"><div class="arrow"></div><div class="popover-inner"><h3 class="popover-title"></h3><div class="popover-content"><div></div></div></div></div>'
            });
        });
    }

    // Renders the named template with the given context and updates the content pane to show the
    // result.
    function renderContentPane(template, context) {
        // Clean up old content
        list_pane.find('li').removeClass('selected');
        $('body > .popover').remove();
        $('body').scrollTop(0);

        dust.render(template, context, function (err, html) {
            content_pane.html(html);
            setupPopovers();
        });
    }

    // Renders the details of the given type in the main content pane.
    function showType(type) {
        if (!type) {
            content_pane.empty();
        } else {
            renderContentPane('named_type', type);

            // Mark the currently displayed type with a 'selected' CSS class in the type list
            list_pane.find('a').filter(function () {
                return $(this).attr('href') === type.shared_link;
            }).parents('li').addClass('selected');
        }
    }

    // Returns a mapping from qualified name to shared type. A shared type may have one or more
    // versions (conflicting definitions for the same qualified name). Each version may have one or
    // more definitions (equivalent definitions of the same type in different schema files).
    function typeByQualifiedName() {
        var by_qualified_name = {};
        _(shared_types).each(function (versions, qualified_name) {
            by_qualified_name[qualified_name] = _(versions[0]).clone();
            by_qualified_name[qualified_name].versions = versions;
        });
        return by_qualified_name;
    }

    // Groups the types defined in all schemas by namespace, and sorts them alphabetically.
    // A namespace has many named types (records, enums or fixed).
    function typesByNamespace(by_qualified_name) {
        var namespaces = {};
        var current_order = 0;
        _(by_qualified_name).each(function (shared_type) {
            var namespace = shared_type.namespace || '';
            if (!_(namespaces).has(namespace)) {
                var orderForNamespace = current_order;
                if (namespace === current_root_namespace) {
                   orderForNamespace = -1;
                }
                namespaces[namespace] = {namespace: namespace, order: orderForNamespace, types: [], messages: []};
            }
            if (shared_type.is_message) {
                namespaces[namespace].messages.push(shared_type);
            } else {
               namespaces[namespace].types.push(shared_type);
            }
            current_order++;
        });

        return _(_(namespaces).sortBy('order')).map(function (ns_types) {
            return {
                namespace: ns_types.namespace || 'No namespace',
                types: _(ns_types.types).sortBy('name'),
                messages: _(ns_types.messages).sortBy('name')
            };
        });
    }

    function namespaceSort(type1, type2) {
        if (type2 === current_root_namespace) return -1;
        if (type1 < type2) return -1;
        if (type1 > type2) return +1;
        return 0;
    }

    // Call this once when the schemata have been loaded and we want to launch the app.
    function ready() {
        // Fields used by the schema_list template
        _public.schemata = _(schema_by_name).values();
        _public.by_qualified_name = typeByQualifiedName();
        _public.namespaces = typesByNamespace(_public.by_qualified_name);
        renderPopovers();

        dust.render('schema_list', _public, function (err, html) {
            list_pane.html(html);
        });

        Sammy(function () {
            this.get('#/schema/:filename/:qualified_name', function () {
                var schema = schema_by_name[this.params.filename];
                showType(schema && schema.named_types[this.params.qualified_name]);
            });

            this.get('#/schema/:qualified_name', function () {
                showType(_public.by_qualified_name[this.params.qualified_name]);
            });

            this.get('#/', function () {
                if (_public.schemata.length === 1) {
                    showType(_public.schemata[0].root_type);
                } else {
                    renderContentPane('schema_file_list', _public);
                }
            });

            this.notFound = function () {
                window.location.hash = '#/';
            };
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

        schema_by_name[filename] = AvroDoc.Schema(shared_types, json, filename);
        current_root_namespace = schema_by_name[filename].root_namespace;
    }


    // Load any schemata that were specified by filename. When they are loaded, start up the app.
    var in_progress = 0, schemata_to_load;

    input_schemata = input_schemata || [];
    _(input_schemata).each(function (schema) {
        if (schema.json) {
            addSchema(schema.json, schema.filename);
        } else if (schema.filename) {
            in_progress++;
            $.getJSON(schema.filename, function (json) {
                addSchema(json, schema.filename);
                in_progress--;
                if (in_progress === 0) {
                    content_pane.text('Processing...');
                    window.setTimeout(ready, 10);
                } else {
                    content_pane.text('Loaded ' + (schemata_to_load - in_progress) + ' out of ' +
                                      schemata_to_load + ' schemata...');
                }
            });
        } else {
            throw 'You must specify JSON or a filename for a schema';
        }
    });

    schemata_to_load = in_progress;

    if (in_progress === 0) {
        ready();
    }

    return _public;
}
