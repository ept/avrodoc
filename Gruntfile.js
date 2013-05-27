module.exports = function (grunt) {

    grunt.initConfig({
        pkg: '<json:package.json>',

        jshint: {
            files: ['app.js', 'lib/*.js', 'public/js/*.js'],
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

    grunt.registerTask('test', ['jshint']);
    grunt.registerTask('default', ['test']);
};
