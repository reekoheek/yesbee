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
    pantsPath = require('./path');

process.on('uncaughtException', function(err) {
    console.error('UNCAUGHT:', err.stack);
});

var createWorker = function() {
    "use strict";

    var worker = cluster.fork();

    worker.on('message', function(message) {
        var i;

        if (message.method) {
            if (message.reply) {
                message.replyLength = Object.keys(cluster.workers).length;
                cluster.workers[message.origin].send(message);
                return;
            }

            if (message.method === 'shutdown') {
                for(i in cluster.workers) {
                    cluster.workers[i].send({
                        method: 'stop'
                    });
                }
                process.exit();
                return;
            }

            message.origin = worker.id;
            for(i in cluster.workers) {
                message.destination = i;
                cluster.workers[i].send(message);
            }
        }

    });
};

var doRun = function(manifest, signal) {
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

    if (cluster.isMaster && manifest.workers !== 'none') {
        util.print(clc.bold.yellow(':: yesbee v%s (mode: %s)'), version, manifest.mode);

        // Fork workers.
        var debug = process.execArgv.indexOf('--debug') !== -1;
        cluster.setupMaster({
            execArgv: process.execArgv.filter(function(s) { return s !== '--debug'; })
        });


        for (var i = 0; i < manifest.workers; i++) {
            if (debug) cluster.settings.execArgv.push('--debug=' + (5859 + i));
            createWorker();
            if (debug) cluster.settings.execArgv.pop();
        }

        cluster.on('exit', function(worker, code, signal) {
            if (worker.suicide !== true && code != 33) {
                if (debug) cluster.settings.execArgv.push('--debug=' + (5859 + i));
                createWorker();
                if (debug) cluster.settings.execArgv.pop();
            }
        });
    } else {
        if (manifest.workers === 'none' && signal === 'start') {
            util.print(clc.bold.yellow(':: yesbee v%s (mode: %s no-worker)'), version, manifest.mode);
        }
        // populate manifest.json file and merge to props
        var container = new Container(manifest);
        container[signal]();

        var replies = {};

        process.on('message', function(message) {
            if (message.method) {
                if (message.reply) {
                    replies[message.id] = replies[message.id] || [];
                    replies[message.id].push(message);
                    if (replies[message.id].length >= message.replyLength) {
                        container.reply({
                            id: message.id,
                            reply: replies[message.id]
                        });
                        delete replies[message.id];
                    }
                    return;
                }

                util.promise(function(resolve, reject) {
                        return container[message.method].apply(container, message.arguments);
                    }).then(function(result) {
                        message.reply = true;
                        message.result = result;
                        try {
                            process.send(message);
                        } catch(e) {
                            logger().error('Error send reply', e);
                        }
                    }).done();

            }
        });
    }
};

var setValue = function(o, k, v) {
    "use strict";
    pantsPath(o).set(k, v);
};

module.exports = function() {
    "use strict";

    var mode = process.env.YESBEE_ENV || 'development';

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

    if (argv.h) {
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
    } else {
        doRun(manifest, argv.s);
    }
};