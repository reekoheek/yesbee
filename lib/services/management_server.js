/**
 * yesbee management_server
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
var net = require('net'),
    minimist = require('minimist'),
    util = require('../util');

var val = function(v) {
    "use strict";

    return (typeof v === 'function') ? v() : v;
};

var Server = function(context) {
    "use strict";

    var version = require('../../package').version;

    this.context = context;
    this.container = context.container;
    this.LOG = context.LOG;

    this.port = this.container.prop('management.server.port') || 9999;
    this.host = this.container.prop('management_server.host') || 'localhost';
    this.motd = this.container.prop('management_server.motd') || (
        '                     __            \n' +
        '    __  _____  _____/ /_  ___  ___ \n' +
        '   / / / / _ \\/ ___/ __ \\/ _ \\/ _ \\\n' +
        '  / /_/ /  __(__  ) /_/ /  __/  __/\n' +
        '  \\__, /\\___/____/_.___/\\___/\\___/ \n' +
        ' /____/                    v' + version + '\n'
    );
    this.prompt = '#' + this.container.prop('workerId') + (this.container.prop('prompt') || '> ');

    this.clients = [];

    this.s = net.createServer(function(c) {
        var remoteAddress = c.remoteAddress,
            remotePort = c.remotePort;

        this.LOG.info('Client connected from %s:%s', remoteAddress, remotePort);

        this.clients.push(c);

        c.setEncoding('utf-8');

        c.writePrompt = function() {
            c.write(val(this.prompt));
        }.bind(this);

        c.write(val(this.motd) + '\n');
        c.writePrompt();

        c.on('data', function(data) {
            data = data.trim();

            if (!data) {
                c.writePrompt();
                return;
            }

            var segments = data.split(/\s+/),
                method = segments[0];

            segments.shift();

            try {
                var parsed = minimist(segments);
                this.container.invokeCommand(method, {
                    method: method,
                    args: parsed._,
                    options: parsed,
                    stdio: [null, c, c]
                }).then(function() {
                    c.writePrompt();
                }, function(e) {
                    this.LOG.error('Command "%s" error', method, e);
                    if (e.code === 'MODULE_NOT_FOUND') {
                        c.write('Command \'' + method + '\' not found!\n');
                    } else {
                        c.write('Command error \'' + method + '\': ' + e.message + '\n');
                    }
                    c.writePrompt();
                }.bind(this));
            } catch(e) {
                c.write('Unknown error\n');
                c.writePrompt();
            }
        }.bind(this));

        c.on('end', function() {
            var index = this.clients.indexOf(c);
            this.clients.splice(index, 1);
            console.log('Client disconnected from %s:%s', remoteAddress, remotePort);
            this.LOG.info('Client disconnected from %s:%s', remoteAddress, remotePort);
        }.bind(this));
    }.bind(this));
};

Server.prototype.listen = function() {
    "use strict";

    return util.promise(function(resolve, reject) {
        this.s.listen(this.port, this.host, function() {
            resolve(this.s);
        }.bind(this));
    }.bind(this));
};

// FIXME if worker on cluster close the server, it wont stop listening from master
Server.prototype.close = function() {
    "use strict";

    this.clients.forEach(function(client) {
        client.end('Server will be stopped soon! Bye!');
    });

    this.s.close(function() {
        console.log('%s: management server stopped', this.container.prop('workerId'));
    }.bind(this));
};

module.exports = function(yesbee) {
    "use strict";

    Object.defineProperties(this, {
        server: {
            value: null,
            enumerable: false,
            writable: true,
            configurable: false
        }
    });

    this.on('started', function() {
        this.server = new Server(this);
        this.server.listen().then(function(s) {
            this.LOG.info('Management server bound to %s:%s', s.address().address, s.address().port);
        });
    });

    this.on('stopping', function() {
        this.server.close();
    });
};