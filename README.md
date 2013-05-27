Avrodoc
=======

Avrodoc is a documentation tool for [Avro](http://avro.apache.org/) schemas. It reads schemas in
Avro's JSON schema format -- `*.avsc` files -- and renders them nicely in a web browser.

Take a look at [the example](http://avrodoc.herokuapp.com/#/), which is generated from
[this schema](https://github.com/ept/avrodoc/blob/master/schemata/example.avsc).

Why? Because your data type definitions are your most important API... and you would never make an
API without good documentation, would you?


How to use
----------

You need [node.js](http://nodejs.org/) installed.

Avrodoc can be used in two modes of operation:

* As a command-line tool, taking one or more Avro schema files, and generating a self-contained HTML
  file that you can put on a web server, send by email, check into your repository, etc.
* As a Node.js web app, serving documentation for any Avro schema files you put in in the server's
  `schemata` directory.

To run as a command-line tool:

    $ npm install avrodoc -g
    $ avrodoc [my-schema.avsc [another-schema.avsc...]] [-o=my-documentation.html] [> my-documentation.html] [-- my-schema.avsc [another-schema.avsc]]
    # open my-documentation.html in a web browser

To run as a web app:

    $ git clone git://github.com/ept/avrodoc.git
    $ cd avrodoc
    # put your schema files in the schemata/ directory
    $ npm update
    $ node app
    # open http://localhost:8124/ in a web browser

If you want to change the schema file directory, set the `SCHEMA_DIR` environment variable. If you
want to use a port other than 8124, set the `PORT` environment variable. The app is ready to deploy
to [Heroku](http://www.heroku.com/): add your schema files to the `schemata` directory, commit,
then run `heroku create && git push heroku master`.


Features
--------

* Excellent for getting an overview of a complex schema with many nested records
* Support for [Markdown](http://daringfireball.net/projects/markdown/syntax) in doc strings, so you
  can add links, emphasis etc.
* Detects duplicate definitions of types across schema files, and does the right thing
* Fully compatible with Avro IDL 1.7.3


Testing
-------

To run the browser tests locally on your machine:

1. Download the [ChromeDriver server](https://code.google.com/p/chromedriver/downloads/list) for
   your OS, and put it in your `$PATH`.
2. Download the standalone [Selenium server](https://code.google.com/p/selenium/downloads/list).
3. Run Selenium server: `java -jar selenium-server-standalone-$VERSION.jar`
4. Run the Avrodoc web app: `node app`
5. Run the tests: `grunt selenium`

To run the browser tests remotely in the cloud:

1. Sign up for a free account at [Sauce Labs](https://saucelabs.com/).
2. Download [Sauce Connect](https://saucelabs.com/docs/connect).
3. Run Sauce Connect, providing the username and API key of your account:
   `java -jar Sauce-Connect.jar -P 4444 $USERNAME $API_KEY`.
4. Run the Avrodoc web app: `node app`
5. Run the tests: `grunt selenium`

Meta
----

Copyright 2012 Martin Kleppmann. Licensed under the Apache License, Version 2.0.
See `LICENSE` for details. Thanks to contributors:

* [Micah Huff](https://github.com/mphuff) ([Inome, Inc.](https://github.com/inome))

Pull requests welcome.
