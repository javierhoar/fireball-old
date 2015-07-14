﻿var Path = require('path');
var Ipc = require('ipc');

var WAIT_MS = 100;
var RELOAD_WINDOW_SCRIPTS = 'scene:stash-and-reload';
//var COMPILE_AND_RELOAD = 'app:compile-and-reload';
var COMPILE_BEGIN = 'app:compile-begin';
var COMPILE_END = 'app:compile-end';

var needRecompile = false;

var compilingWorker = null;
var firstError = null;

Ipc.on('app:compile-worker:error', function (error) {
    firstError = firstError || error;
    stopWorker();
});

Ipc.on('app:compile-worker:end', function () {
    Editor.log('Compiled successfully');
    stopWorker();
});

function stopWorker () {
    if (compilingWorker) {
        compilingWorker.close();
    }
    else {
        Editor.error('None exists compiling worker');
    }
}

var Compiler = {

    compileScripts: function (callback) {
        Editor.sendToWindows(COMPILE_BEGIN);

        var options = {
            project: Editor.projectPath,
            debug: true,
        };
        this.doCompile(options,
            function (error) {
                if (error) {
                    Editor.error(error);
                }
                if (callback) {
                    callback(!error);
                }
                Editor.sendToWindows(COMPILE_END);
            }
        );
    },

    doCompile: function (options, callback) {
        if (compilingWorker) {
            return;
        }

        //options.globalPluginDir = Editor.dataPath;
        //options.pluginSettings = Editor.loadProfile('plugin', 'project');

        firstError = null;
        compilingWorker = Editor.App.spawnWorker('app://canvas-studio/page/compile-worker', function (browser) {
            browser.once('closed', function () {
                compilingWorker = null;
                if (callback) {
                    callback(firstError);
                }
            });

            browser.webContents.send('app:compile-worker:start', options);
        });
    },

    compileAndReload: function () {
        this.compileScripts(function (compiled) {
            Editor.sendToWindows(RELOAD_WINDOW_SCRIPTS, compiled);
        });
    }
};

var debounceId;
function compileLater () {
    if (debounceId) {
        clearTimeout(debounceId);
    }
    debounceId = setTimeout(function () {
        Compiler.compileAndReload();
    }, WAIT_MS);
}

//Ipc.on(COMPILE_AND_RELOAD, function () {
//    Compiler.compileAndReload();
//});

//// register messages so that it will recompile scripts if needed
//function isScript (path) {
//    return Path.extname(path).toLowerCase() === '.js';
//}
//function isScriptResult (res) {
//    return isScript(res.url);
//}
Ipc.on('asset:changed', function (type, uuid) {
    console.log(arguments);
    if (type === 'javascript') {
        compileLater();
    }
});
//Ipc.on('asset:moved', function ( detail ) {
//    var uuid = detail.uuid;
//    var destUrl = detail['dest-url'];
//    needRecompile = needRecompile || isScript(destUrl);
//});
//Ipc.on('assets:created', function (detail) {
//    var results = detail.results;
//    needRecompile = needRecompile || results.some(isScriptResult);
//});
//Ipc.on('assets:deleted', function (detail) {
//    var results = detail.results;
//    needRecompile = needRecompile || results.some(isScriptResult);
//});
//Ipc.on('asset-db:synced', function () {
//    if (needRecompile) {
//        needRecompile = false;
//        Compiler.compileAndReload();
//    }
//});

module.exports = Compiler;
