/*jshint node:true, evil:true */

var wd = require('wd');
var assert = require('assert');
var browser = wd.promiseRemote();

browser.on('status', function (info) {
    console.log('\x1b[36m%s\x1b[0m', info);
});

browser.on('command', function (meth, path, data) {
    console.log(' > \x1b[33m%s\x1b[0m: %s', meth, path, data || '');
});

module.exports = function (finish) {
    var environment = {browserName: 'chrome'};
    if (process.env.TRAVIS && process.env.TRAVIS_JOB_NUMBER) {
        environment['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
        environment.build = process.env.TRAVIS_BUILD_NUMBER;
        environment.tags = ['Travis'];
    }

    browser.init(environment).then(function () {
        return browser.get('http://localhost:8124/');
    }).then(function () {
        return browser.setImplicitWaitTimeout(10000);
    }).then(function () {
        return browser.title();
    }).then(function (title) {
        assert.ok(title.indexOf('Avrodoc') >= 0, 'Wrong title!');
        return browser.elementByXPath('//ul[@class="types"]//a[.="ToDoItem"]');
    }).then(function (el) {
        return browser.clickElement(el);
    }).then(function () {
        return browser.eval('window.location.href');
    }).then(function (href) {
        assert.ok(href.indexOf('#/schema/com.example.avro.ToDoItem') >= 0);
    }).fin(function () {
        browser.quit();
    }).done(finish, finish);
};
