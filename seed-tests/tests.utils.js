var exec = require('child_process').exec;
var rimraf = require('rimraf');
var copy = require('recursive-copy');
var fs = require('fs');
var async = require("async");
var os = require('os');
var constants = require('./tests.constants');

exports.findInFiles = function findInFiles(string, dir, callback) {
    var _resultsCount = 0;
    var _excludedPaths = ["node_modules", "demo/report", "demo/node_modules", "src/scripts/postclone", "src-native/", "/seed-tests/", ".git"];

    function _findInFiles(string, dir, callback) {
        fs.readdir(dir, function (err, entries) {
            entries = entries.filter(function (entry) {
                var fullEntry = dir + '/' + entry;
                var shouldBeIncluded = true;
                _excludedPaths.forEach(function callback(currentValue) {
                    shouldBeIncluded = fullEntry.indexOf(currentValue) === -1 && shouldBeIncluded;
                });

                return shouldBeIncluded;
            });
            async.eachSeries(entries, function (entry, foreachCallback) {
                entry = dir + '/' + entry;
                fs.stat(entry, function (err, stat) {
                    if (stat && stat.isDirectory()) {
                        _findInFiles(string, entry, foreachCallback);
                    } else {
                        fs.readFile(entry, 'utf-8', function (err, contents) {
                            if (contents.indexOf(string) > -1) {
                                _resultsCount++;
                            }

                            foreachCallback();
                        });
                    }
                });
            }, function (err) {
                callback();
            });
        });
    };

    _findInFiles(string, dir, function () {
        callback(_resultsCount);
    });
};

exports.copySeedDir = function copySeedDir(seedLocation, copyLocation, callback) {
    rimraf.sync(copyLocation);

    copy(seedLocation, copyLocation, {
        dot: true,
        filter: function (fileName) {
            if (fileName.indexOf("seed-tests/" + constants.SEED_COPY_LOCATION) > -1 ||
                fileName.indexOf("demo/node_modules") > -1 ||
                fileName.indexOf("src/node_modules") > -1 ||
                fileName.indexOf("src-native/android/.gradle/") > -1 ||
                fileName.indexOf("src-native/android/build/") > -1 ||
                fileName.indexOf("publish/package/") > -1 ||
                fileName.indexOf("demo/platforms") > -1) {
                return false;
            }

            return true;
        }
    }, function (err) {
        if (!err) {
            console.log(copyLocation + ' folder successfully created.');
        }
        callback(err);
    });
};

exports.callPostclone = function callPostclone(seedLocation, githubUsername, pluginName, initGit, callback) {
    var postcloneScript = getPackageJsonPostcloneScript();
    postcloneScript = postcloneScript.replace("postclone.js", "postclone.js gitHubUsername=" + githubUsername + " pluginName=" + pluginName + " initGit=" + initGit);
    exec("cd " + seedLocation + "/src && " + postcloneScript, function (error, stdout, stderr) {
        callback(error, stdout, stderr);
    });
};

exports.callDevelopmentSetup = function callDevelopmentSetup(seedLocation, callback) {
    exec("cd " + seedLocation + "/src && npm run development.setup", function (error, stdout, stderr) {
        callback(error, stdout, stderr);
    });
};

exports.getModulesLinks = function getModulesLinks(modulesDir, callback) {
    exec("find . -maxdepth 1 -type l -ls", { cwd: modulesDir }, function (error, stdout, stderr) {
        var links = stdout.split(os.EOL)
            .filter(function (item) {
                return item && item.length > 0;
            });

        callback(links);
    });
}

exports.removeNpmLink = function removeNpmLink(packageName, callback) {
    exec("npm remove " + packageName + " -g", function (error, stdout, stderr) {
        callback();
    });
}

exports.isAndroid = function isAndroid() {
    return !!!process.env.IOS;
}

function getPackageJsonPostcloneScript() {
    var packageJsonFile = constants.SEED_COPY_LOCATION + "/src/package.json";

    if (fs.lstatSync(packageJsonFile).isFile()) {
        var packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
        var packageJsonScripts = packageJson["scripts"];

        if (packageJsonScripts && packageJsonScripts["postclone"]) {
            return packageJsonScripts["postclone"];
        };
    }

    return "";
}