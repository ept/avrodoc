var AvroDoc = AvroDoc || {};

// Interprets the contents of one Avro Schema (.avsc) file and transforms it into structures
// suitable for rendering.
//
// shared_types: An object of the form
//      {'namespace.name': [{type: 'record', fields: [...]}, {type: 'record', fields: [...]}, ...], ...}
//    This object is mutated as the schema is parsed; we add the types defined in this schema to the
//    structure. Different schema files may define the same type differently, hence the array of
//    types for each qualified name. However, where two different schema files agree on the
//    definition of a type, we can share the parsed type between the different files.
//
// schema_json: The .avsc file, parsed into a structure of JavaScript objects.
//
// filename: The name of the file from which the schema was loaded, if available.
//
AvroDoc.Schema = function (shared_types, schema_json, filename) {
    var _public = {filename: filename};

    // {'namespace.name': {type: 'record', fields: [...]}}
    // containing only types and messages defined in this schema
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
        schema.filename = filename;
        schema['is_' + schema.type] = true;
        if (_(primitive_types).contains(schema.type)) {
            schema.is_primitive = true;
        } else {
            schema.link = [
                '#', 'schema', encodeURIComponent(filename || 'default'),
                encodeURIComponent(qualifiedName(schema))
            ].join('/');
            schema.shared_link = [
                '#', 'schema', encodeURIComponent(qualifiedName(schema))
            ].join('/');
        }
        if (schema.shared) decorate(schema.shared);
        return schema;
    }

    function joinPath(parent, child) {
        return parent ? [parent, child].join('.') : child;
    }

    // Given a type name and the current namespace, returns an object representing the type that the
    // name refers to (or throws an exception if the name cannot be resolved). For named types, the
    // same (shared) object is returned whenever the same name is requested.
    function lookupNamedType(name, namespace, path) {
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

    // Given an object representing a type (as returned by lookupNamedType, for example), returns
    // the qualified name of that type. We recurse through unnamed complex types (array, map, union)
    // but named types are replaced by their name.
    function extractTypeName(schema, namespace) {
        var _schema = _(schema);
        if (_schema.isString()) {
            return schema;
        } else if (_schema.isObject() && !_schema.isArray()) {
            if (schema.type === 'record' || schema.type === 'enum' || schema.type === 'fixed') {
                return qualifiedName(schema, namespace);
            } else if (schema.type === 'array') {
                return {type: 'array', items: extractTypeName(schema.items, namespace)};
            } else if (schema.type === 'map') {
                return {type: 'map', values: extractTypeName(schema.values, namespace)};
            } else if (schema.type === 'union') {
                return _(schema.types).map(function (type) {
                    return extractTypeName(type, namespace);
                });
            } else if (_(primitive_types).contains(schema.type)) {
                return schema.type;
            } else {
                throw 'extractTypeName: unsupported Avro schema type: ' + JSON.stringify(schema.type);
            }
        } else if (_schema.isArray()) {
            return _schema.map(function (type) {
                return extractTypeName(type, namespace);
            });
        } else {
            throw 'extractTypeName: unexpected schema: ' + JSON.stringify(schema);
        }
    }

    // Given a JSON object representing a named type (record, enum, message or fixed), returns a new object
    // containing only fields that are essential to the definition of the type. This is useful for
    // equality comparison of types.
    function typeEssence(schema) {
        var essence = {type: schema.type, name: qualifiedName(schema, schema.namespace)};
        if (schema.type === 'record') {
            essence.fields = _(schema.fields).map(function (field) {
                return {name: field.name, type: extractTypeName(field.type, schema.namespace)};
            });
        } else if (schema.type === 'enum') {
            essence.symbols = schema.symbols;
        } else if (schema.type === 'fixed') {
            essence.size = schema.size;
        } else if (schema.type === 'message') {
            // something needed here?
        } else {
            throw 'typeEssence() only supports named types, not ' + schema.type;
        }
        return essence;
    }

    // Takes a named type (record, enum or fixed) and adds it to the maps of name to type. If a type
    // with the same qualified name and the same definition is already defined in another schema
    // file, that existing definition is reused. If the qualified name is not yet defined, or the
    // existing definitions differ from this type, a new definition is registered.
    //
    // Note that within one schema file, a qualified name may only map to one particular definition.
    // However, it is acceptable for different schema files to have conflicting definitions for the
    // same qualified name, because different schema files are independent. The sharing of
    // equivalent types is only for conciceness of display.
    function defineNamedType(schema, path) {
        var qualified_name = qualifiedName(schema, schema.namespace);
        var new_type = typeEssence(schema);
        var shared_schema = null;

        if (_(shared_types).has(qualified_name)) {
            shared_schema = _(shared_types[qualified_name]).find(function (shared_schema) {
                return _(new_type).isEqual(typeEssence(shared_schema));
            });
        } else {
            shared_types[qualified_name] = [];
        }

        if (_(named_types).has(qualified_name)) {
            var existing_type = typeEssence(named_types[qualified_name]);
            if (!_(new_type).isEqual(existing_type)) {
                throw 'Conflicting definition for type ' + qualified_name + ' at ' + path + ': ' +
                        JSON.stringify(existing_type) + ' != ' + JSON.stringify(new_type);
            }
        } else {
            // Type has not yet been defined in this schema file
            named_types[qualified_name] = schema;
            if (shared_schema) {
                shared_schema.definitions.push(schema);
            } else {
                shared_schema = _(schema).clone(); // shallow clone
                shared_schema.definitions = [schema];
                shared_types[qualified_name].push(shared_schema);
            }
        }
        schema.shared = shared_schema;
    }

    // Decorates a message with some of the basic data that is required and is automatically generated 
    // for other types of objects. Generates a link for the response object as well as the list of
    // input parameters. 
    function decorateMessage(messageName, schemaMessage, namespace) {
       schemaMessage.type = 'message';
       schemaMessage.namespace = namespace;
       schemaMessage.name = messageName;
       schemaMessage.response = lookupNamedType(schemaMessage.response, namespace);
       if (schemaMessage.request !== null) {
          for (var i = 0; i < schemaMessage.request.length; i++) {
             schemaMessage.request[i].type = lookupNamedType(schemaMessage.request[i].type, namespace);
          }
       }
       schemaMessage = decorate(schemaMessage);
       return schemaMessage;
    }

    // Similar to how a top-level schema is parsed out, parse out all messages
    // in a slightly different manner. This allows for not only the object definitions to
    // be included in the documentation but also any messages included in the Avro schema.
    function parseMessages(schema) {
       var _schema = _(schema);
       if (_schema.isNull() || _schema.isUndefined()) {
          throw 'Schema is null in parseMessages';
       }
       else if (_schema.isObject() && !_schema.isArray()) {
          if (schema.messages !== null) {
             for (var messageName in schema.messages) {
	        var decoratedMessage = decorateMessage(messageName, schema.messages[messageName], schema.namespace);
	        defineNamedType(decoratedMessage);
	     }
          }
       }
    }

    function parseSchema(schema, namespace, path) {
        var _schema = _(schema);
        if (_schema.isNull() || _schema.isUndefined()) {
            throw 'Missing schema type at ' + path;
        } else if (_schema.isString()) {
            return lookupNamedType(schema, namespace, path);
        } else if (_schema.isObject() && !_schema.isArray()) {
            if (schema.type === 'record') {
                if (!_(schema.fields).isArray()) {
                    throw 'Unexpected value ' + JSON.stringify(schema.fields) + ' for record fields at ' + path;
                }
                schema.namespace = schema.namespace || namespace;
                defineNamedType(schema, path);
                _(schema.fields).each(function (field) {
                    field.type = parseSchema(field.type, schema.namespace, joinPath(path, field.name));
                });
                return decorate(schema);
            } else if (schema.type === 'enum') {
                if (!_(schema.symbols).isArray()) {
                    throw 'Unexpected value ' + JSON.stringify(schema.symbols) + ' for enum symbols at ' + path;
                }
                schema.namespace = schema.namespace || namespace;
                defineNamedType(schema, path);
                return decorate(schema);
            } else if (schema.type === 'fixed') {
                if (typeof schema.size !== 'number' || schema.size < 1) {
                    throw 'Unexpected size ' + JSON.stringify(schema.size) + ' for fixed type at ' + path;
                }
                schema.namespace = schema.namespace || namespace;
                defineNamedType(schema, path);
                return decorate(schema);
            } else if (schema.type === 'array') {
                schema.items = parseSchema(schema.items, namespace, joinPath(path, 'items'));
                return decorate(schema);
            } else if (schema.type === 'map') {
                schema.values = parseSchema(schema.values, namespace, joinPath(path, 'values'));
                return decorate(schema);
            } else if (_(primitive_types).contains(schema.type)) {
                return decorate(schema);
            } else if (schema.types !== null) {
                return parseSchema(schema.types, schema.namespace);
            } else {
                throw 'Unsupported Avro schema type "' + schema.type + '" at ' + path;
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
    if (schema_json.namespace) {
        _public.root_namespace = schema_json.namespace;
    }
    _public.root_type.is_root_type = true;
    parseMessages(schema_json);
    _public.named_types = named_types;

    //_public.sorted_types = _(named_types).values().sort(function (type1, type2) {
    //    if (type1.name < type2.name) return -1;
    //    if (type1.name > type2.name) return +1;
    //    return 0;
    //});

    return _public;
};
