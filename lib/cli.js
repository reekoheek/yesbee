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
    path = require('path'),
    fs = require('fs'),
    cluster = require('cluster'),
    logger = require('./logger'),
    clc = require('cli-color'),
    Q = require('q'),
    Table = require('easy-table'),
    version = require('../package').version,
    util = require('./util');

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

var doRun = function(manifest) {
    "use strict";

    if (cluster.isMaster && manifest.worker !== 'none') {
        util.print(clc.bold.yellow(':: yesbee v%s (env: %s)'), version, manifest.ENV);

        // Fork workers.
        var debug = process.execArgv.indexOf('--debug') !== -1;
        cluster.setupMaster({
            execArgv: process.execArgv.filter(function(s) { return s !== '--debug'; })
        });
        for (var i = 0; i < manifest.worker; ++i) {
            if (debug) cluster.settings.execArgv.push('--debug=' + (5859 + i));
            createWorker();
            if (debug) cluster.settings.execArgv.pop();
        }

        cluster.on('exit', function(worker, code, signal) {
            if (worker.suicide !== true) {
                if (debug) cluster.settings.execArgv.push('--debug=' + (5859 + i));
                createWorker();
                if (debug) cluster.settings.execArgv.pop();
            }
        });
    } else {
        if (manifest.worker === 'none') {
            util.print(clc.bold.yellow(':: yesbee v%s (env: %s no-worker)'), version, manifest.ENV);
        }
        // populate manifest.json file and merge to props
        var container = require('../lib/container')(manifest);
        container.start();

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
                Q.when(container[message.method].apply(container, message.arguments)).then(function(result) {
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

    eval('o.' + k + ' = v;');
};

module.exports = function() {
    "use strict";

    var ENV = process.env.YESBEE_ENV || 'development';

    var manifestFile = path.resolve(argv.c || './manifest.json'),
        manifest = {},
        i;

    if (fs.existsSync(manifestFile)) {
        try {
            manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
            manifest.ENV = ENV;

            if (manifest.env) {
                if (manifest.env[ENV]) {
                    for(i in manifest.env[ENV]) {
                        manifest[i] = manifest.env[ENV][i];
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
            var value = p.slice(1).join('=');
            setValue(manifest, key, value);
        });
    }

    manifest.container = path.resolve(manifest.container || '.');

    if (manifest.worker) {
        if (manifest.worker === 'auto') {
            manifest.worker = require('os').cpus().length;
        }
    } else {
        manifest.worker = 1;
    }

    manifest.workerId = (cluster.worker) ? cluster.worker.id : 1;

    if (argv.h) {
        util.print('yesbee v' + version + ' ENV: ' + ENV);
        util.print('Usage: yesbee [-h] [-c filename] [-p directives] [-s signal]');
        util.print('\nOptions');
        util.print(Table.printObj({
            '  -h help': 'show this help',
            '  -c configuration file': 'set configuration file (default: ./manifest.json)',
            '  -p properties': 'set properties out of configuration file',
            '  -s signal': 'send signal to a master process: stop, restart'
        }));

        util.print('Properties');
        util.print(Table.printObj({
            '  container': 'container which yesbee will run at',
            '  worker': 'number of worker will be activated',
            '  autostart': 'services that autostarted',
            '  dependencies': 'custom scope dependencies (loaded before container scope)'
        }));
    } else if (argv.s) {
        logger().error('ENV: ' + ENV + ' Cannot send signal yet, unimplemented at this point of version.');
    } else {
        doRun(manifest);
    }
};