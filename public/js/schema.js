var AvroDoc = AvroDoc || {};

AvroDoc.Schema = function (schema_json, filename) {
    var _public = {filename: filename};

    // 'namespace.recordname' => {type: 'record', fields: [...]}
    var named_types = {};

    var primitive_types = ['null', 'boolean', 'int', 'long', 'float', 'double', 'bytes', 'string'];
    var complex_types = ['record', 'enum', 'array', 'map', 'union', 'fixed'];
    var types = primitive_types.concat(complex_types);

    function qualifiedName(schema, namespace) {
        var type_name, _schema = _(schema);
        if (_schema.isString()) {
            type_name = schema;
        } else if (_schema.isObject() && !_schema.isArray()) {
            namespace = schema.namespace || namespace;
            type_name = schema.name || schema.type;
        }

        if (!type_name) {
            throw 'unable to determine type name from schema ' + JSON.stringify(schema) + ' in namespace ' + namespace;
        } else if (type_name.indexOf('.') >= 0) {
            return type_name;
        } else if (_(primitive_types).contains(type_name)) {
            return type_name;
        } else if (namespace) {
            return namespace + '.' + type_name;
        } else {
            return type_name;
        }
    }

    // Takes a node in the schema tree (a JS object) and adds some fields that are useful for
    // template rendering.
    function decorate(schema) {
        schema['is_' + schema.type] = true;
        if (_(primitive_types).contains(schema.type)) {
            schema.is_primitive = true;
        } else {
            schema.link = [
                '#', 'schema', encodeURIComponent(filename || 'default'),
                encodeURIComponent(qualifiedName(schema))
            ].join('/');
        }
        return schema;
    }

    function joinPath(parent, child) {
        return parent ? [parent, child].join('.') : child;
    }

    function parseNamedType(name, namespace, path) {
        if (_(primitive_types).contains(name)) {
            return decorate({type: name});
        }
        var type = named_types[qualifiedName(name, namespace)];
        if (type) {
            return type;
        } else {
            throw 'Unknown type name ' + JSON.stringify(name) + ' at ' + path;
        }
    }

    function defineNamedType(qualified_name, schema, path) {
        if (_(named_types).has(qualified_name)) {
            if (!_(named_types[qualified_name]).isEqual(schema)) {
                throw 'Conflicting definition for type ' + qualified_name + ' at ' + path;
            }
        } else {
            named_types[qualified_name] = schema;
        }
    }

    function parseSchema(schema, namespace, path) {
        var _schema = _(schema);
        if (_schema.isNull() || _schema.isUndefined()) {
            throw 'Missing schema type at ' + path;
        } else if (_schema.isString()) {
            return parseNamedType(schema, namespace, path);
        } else if (_schema.isObject() && !_schema.isArray()) {
            if (schema.type === 'record') {
                if (!_(schema.fields).isArray()) {
                    throw 'Unexpected value ' + JSON.stringify(schema.fields) + ' for record fields at ' + path;
                }
                schema.namespace = schema.namespace || namespace;
                _(schema.fields).each(function (field) {
                    field.type = parseSchema(field.type, schema.namespace, joinPath(path, field.name));
                });
                defineNamedType(qualifiedName(schema, namespace), schema, path);
                return decorate(schema);
            } else if (schema.type === 'enum') {
                if (!_(schema.symbols).isArray()) {
                    throw 'Unexpected value ' + JSON.stringify(schema.symbols) + ' for enum symbols at ' + path;
                }
                schema.namespace = schema.namespace || namespace;
                defineNamedType(qualifiedName(schema, schema.namespace), schema, path);
                return decorate(schema);
            } else if (schema.type === 'array') {
                schema.items = parseSchema(schema.items, namespace, joinPath(path, 'items'));
                return decorate(schema);
            } else if (schema.type === 'map') {
                schema.values = parseSchema(schema.values, namespace, joinPath(path, 'values'));
                return decorate(schema);
            } else if (_(primitive_types).contains(schema.type)) {
                return decorate(schema);
            } else {
                throw 'Unsupported Avro schema type ' + schema.type + ' at ' + path;
            }
        } else if (_schema.isArray()) {
            if (_schema.isEmpty()) {
                throw 'Unions must have at least one branch type at ' + path;
            }
            return decorate({
                type: 'union',
                types: _schema.map(function (branch_type) {
                    if (_(branch_type).isArray()) {
                        throw 'Unions must not be nested at ' + path;
                    }
                    var type_name = _(branch_type).isObject() ? (branch_type.name || branch_type.type) : branch_type;
                    return parseSchema(branch_type, namespace, joinPath(path, type_name));
                })
            });
        } else {
            throw 'Unexpected schema contents ' + JSON.stringify(schema) + ' at ' + path;
        }
    }


    if (typeof schema_json === 'string') {
        schema_json = JSON.parse(schema_json);
    }

    _public.root_type = parseSchema(schema_json);
    _public.named_types = named_types;

    _public.sorted_types = _(named_types).values().sort(function (type1, type2) {
        if (type1.name < type2.name) return -1;
        if (type1.name > type2.name) return +1;
        return 0;
    });

    return _public;
};
