module.exports = function (grunt) {

    grunt.initConfig({
        pkg: '<json:package.json>',

        jshint: {
            files: ['app.js', 'lib/*.js', 'public/js/*.js', 'test/**/*.js'],
            options: {
                bitwise: true,
                eqeqeq: true,
                forin: true,
                immed: true,
                indent: 4,
                latedef: true,
                quotmark: 'single',
                strict: false,
                undef: true,
                unused: true,
                trailing: true,
                white: true
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('selenium', 'Run Selenum tests', function () {
        require('./test/selenium/basic-test.js')(this.async());
    });

    grunt.registerTask('test', ['jshint', 'selenium']);
    grunt.registerTask('default', ['test']);
};
