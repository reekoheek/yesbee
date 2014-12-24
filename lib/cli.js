/**
 * yesbee cli
 *
 * MIT LICENSE
 *
 * Copyright (c) 2014 PT Sagara Xinix Solusitama - Xinix Technology
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * @author     Ganesha <reekoheek@gmail.com>
 * @copyright  2014 PT Sagara Xinix Solusitama
 */
var argv = require('minimist')(process.argv.slice(2)),
    os = require('os'),
    path = require('path'),
    fs = require('fs'),
    cluster = require('cluster'),
    logger = require('./logger'),
    clc = require('cli-color'),
    Table = require('easy-table'),
    version = require('../package').version,
    util = require('./util'),
    Container = require('./container'),
    pantsPath = require('./path'),
    clusterize = require('./clusterize'),
    mode = process.env.YESBEE_ENV || 'development';

process.on('uncaughtException', function(err) {
    "use strict";

    console.error('UNCAUGHT:', err.stack);
});

var doProcessSignal = function(signal) {
    "use strict";

    signal = signal || 'start';
    switch(signal) {
        case 'stop':
        case 'restart':
            util.print('Unimplemented signal "%s" yet', signal);
            return process.exit(33);
        case 'start':
        case 'info':
            break;
        default:
            util.print('Unknown signal "%s"', signal);
            return process.exit(33);
    }
};

var setValue = function(o, k, v) {
    "use strict";
    pantsPath(o).set(k, v);
};

var prepareManifest = function() {
    "use strict";

    var manifestFile = path.resolve(argv.c || './manifest.json'),
        manifest = {},
        i;

    if (fs.existsSync(manifestFile)) {
        try {
            manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
            manifest.mode = mode;

            if (manifest.env) {
                if (manifest.env[mode]) {
                    for(i in manifest.env[mode]) {
                        manifest[i] = manifest.env[mode][i];
                    }
                }

                delete manifest.env;
            }
        } catch(e) {
            logger().error('Cannot read manifest file', e.message);
            return;
        }
    }


    if (argv.p) {
        if (typeof argv.p === 'string') {
            argv.p = [argv.p];
        }
        argv.p.forEach(function(p) {
            p = p.split('=');
            var key = p[0];
            var value = p.slice(1).join('=').trim();
            if (value[0] === '[' || value[0] === '{') {
                try {
                    value = JSON.parse(value);
                } catch(e) {
                    value = null;
                }
            }
            setValue(manifest, key, value);
        });
    }

    manifest.name = manifest.name || os.hostname();
    manifest.container = path.resolve(manifest.container || '.');

    if (manifest.workers) {
        if (manifest.workers === 'auto') {
            manifest.workers = os.cpus().length;
        }
    } else {
        manifest.workers = 1;
    }

    manifest.workerId = cluster.worker ? cluster.worker.id : 1;
    manifest.workerName = manifest.name + '/' + manifest.workerId;

    var flattened = util.flatten(manifest);

    for(i in flattened) {
        var v = flattened[i];
        if (typeof v === 'string') {
            if (v === 'true') {
                pantsPath(manifest).set(i, true);
            } else if (v === 'false') {
                pantsPath(manifest).set(i, false);
            } else if (!isNaN(v)) {
                pantsPath(manifest).set(i, parseInt(v));
            }
        }
    }

    return manifest;
};

var doHelp = function(manifest) {
    "use strict";

    util.print('yesbee v' + version + ' mode: ' + mode);
    util.print('Usage: yesbee [-h] [-c filename] [-p directives] [-s signal]');
    util.print('\nOptions');
    util.print(Table.printObj({
        '  -h help': 'show this help',
        '  -c configuration file': 'set configuration file (default: ./manifest.json)',
        '  -p properties': 'set properties out of configuration file',
        '  -s signal': 'send signal to a master process: start, stop, restart, info'
    }));

    util.print('Properties');
    util.print(Table.printObj({
        '  container': 'container which yesbee will run at',
        '  worker': 'number of worker will be activated',
        '  autostart': 'services that autostarted',
        '  dependencies': 'custom scope dependencies (loaded before container scope)',
        '  {etc}': 'specific application defined'
    }));
};

module.exports = function() {
    "use strict";

    var manifest = prepareManifest();

    if (argv.h) {
        doHelp(manifest);
    } else {
        var signal = argv.s;

        doProcessSignal(signal);

        var runWorker = function() {
            var container = new Container(manifest);
            container.start();
        };

        if (manifest.workers !== 'none') {
            var testability = {};
            clusterize(manifest.workers)
                .master(function() {
                    util.print(clc.bold.yellow(':: yesbee v%s (mode: %s)'), version, manifest.mode);
                })
                .worker(runWorker)
                .on('sync-test', function(message) {
                    if (!testability[message.body]) {
                        setTimeout(function() {
                            delete testability[message.body];
                        }, 5000);
                        testability[message.body] = true;
                        return true;
                    }
                    throw 'Duplicate test maybe already run from another worker';
                }.bind(this))
                .execute();
        } else {
            util.print(clc.bold.yellow(':: yesbee v%s (mode: %s no-worker)'), version, manifest.mode);
            runWorker();
        }
    }
};