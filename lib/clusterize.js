/**
 * yesbee clusterize
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

var cluster = require('cluster'),
    uuid = require('node-uuid'),
    util = require('./util');

var SESSIONS = {},
    CALLBACKS = {},
    SERVER_CALLBACKS = {},
    HANDLER = null,
    CLUSTER = null;

var error2 = function(e) {
    "use strict";

    var err = {
        message: 'Unknown error',
        code: 0
    };

    if (typeof e === 'string') {
        err.message = e;
    } else {
        err.message = e.message || 'Unknown error';
        err.code = e.code || 0;
    }

    return err;
};

var processReplyMessage = function(message) {
    var session = SESSIONS[message.id];
    if (session) {
        if (message.error) {
            session.errorCount++;
            session.error[message.from] = message.error;
        } else {
            session.resultCount++;
            session.result[message.from] = message.result;
        }
        if ((session.resultCount + session.errorCount) >= message.to.length) {
            message.results = session.result;
            message.errors = session.error;

            if (session.errorCount) {
                session.reject(message.error);
            } else {
                session.resolve(message);
            }
            clearTimeout(session.timeout);
            delete SESSIONS[message.id];
        }
    }
};

var processRequestMessage = function(message) {
    "use strict";

    return util.promise(function(resolve, reject) {
        if (!message.topic) {
            throw 'Undefined topic to process!';
        }

        if (CALLBACKS[message.topic]) {
            var lastCallback = CALLBACKS[message.topic][CALLBACKS[message.topic].length - 1];
            return util.promise(function(resolve, reject) {
                var result = lastCallback(message);
                if (result && typeof result.then === 'function') {
                    return result;
                } else {
                    resolve(result);
                }
            });
        } else if (HANDLER && typeof HANDLER[message.topic] === 'function') {
            return util.promise(function(resolve, reject) {
                var result = HANDLER[message.topic](message.body);
                if (result && typeof result.then === 'function') {
                    return result;
                } else {
                    resolve(result);
                }
            });
        } else {
            throw 'Undefined handler for topic: "' + message.topic + '"!';
        }
    });
};

var processAllMessage = function(message) {
    "use strict";

    if (message.reply) {
        processReplyMessage(message);
    } else {
        processRequestMessage(message).then(
            function(result) {
                message.result = result;
                return message;
            },
            function(error) {
                message.error = error2(error);
                return message;
            }
        ).then(function(message) {
            message.route = message.from;
            message.from = cluster.worker.id;
            message.reply = true;
            clusterize.send(message);
        });
    }
};

var sendAsProxy = function(message) {
    "use strict";

    message.to = [];

    for (var i in cluster.workers) {
        message.to.push(i);
    }

    for (i in cluster.workers) {
        var worker = cluster.workers[i];
        worker.send(message);
    }
};

var Cluster = function(num) {
    "use strict";

    this.num = num || require('os').cpus().length;
    this.masterCallbacks = [];
    this.workerCallbacks = [];

    CLUSTER = this;
};

Cluster.prototype.on = function(topic, callback) {
    "use strict";

    SERVER_CALLBACKS[topic] = callback;

    return this;
};

Cluster.prototype.master = function(callback) {
    "use strict";

    this.masterCallbacks.push(callback);

    return this;
};

Cluster.prototype.worker = function(callback) {
    "use strict";

    this.workerCallbacks.push(callback);

    return this;
};

Cluster.prototype.execute = function() {
    "use strict";

    if (cluster.isMaster) {
        this.masterCallbacks.forEach(function(callback) {
            callback();
        });

        // Fork workers.
        var debug = process.execArgv.indexOf('--debug') !== -1;
        cluster.setupMaster({
            execArgv: process.execArgv.filter(function(s) {
                return s !== '--debug';
            })
        });

        cluster.on('fork', function(worker) {
            worker.on('message', function(message) {
                if (SERVER_CALLBACKS[message.topic]) {
                    message.reply = true;
                    message.to = [message.from];

                    util.promise(function(resolve, reject) {
                        var result = SERVER_CALLBACKS[message.topic](message);
                        resolve(result);
                    }).then(function(result) {
                        message.result = result;
                        message.resultCount = 1;
                        return message;
                    }, function(e) {
                        message.error = error2(e);
                        message.errorCount = 1;
                        return message;
                    }).then(function(message) {
                        cluster.workers[message.from].send(message);
                    }).done();

                } else if (message.route) {
                    cluster.workers[message.route].send(message);
                } else {
                    clusterize.send(message);
                }
            });
        });

        cluster.on('exit', function(worker, code, signal) {
            if (worker.suicide !== true && code != 33) {
                if (debug) cluster.settings.execArgv.push('--debug=' + (5859 + i));
                cluster.fork();
                if (debug) cluster.settings.execArgv.pop();
            }
        });

        for (var i = 0; i < this.num; i++) {
            if (debug) cluster.settings.execArgv.push('--debug=' + (5859 + i));
            cluster.fork();
            if (debug) cluster.settings.execArgv.pop();
        }
    } else {
        process.on('message', processAllMessage);

        this.workerCallbacks.forEach(function(callback) {
            callback();
        });
    }
};

var clusterize = module.exports = function(num) {
    "use strict";

    return new Cluster(num);
};

clusterize.close = function() {
    "use strict";

    for (var i in SESSIONS) {
        var session = SESSIONS[i];
        clearTimeout(session.timeout);
    }
};

clusterize.send = function(message) {
    "use strict";

    if (!CLUSTER) {
        message.id = message.id || uuid.v1();
        message.from = message.from || 1;

        return processRequestMessage(message);
    }

    if (cluster.isMaster) {
        sendAsProxy(message);
    } else {
        message.id = message.id || uuid.v1();
        message.from = message.from || cluster.worker.id;

        return util.promise(function(resolve, reject) {
            if (message.wait) {
                var timeout = setTimeout(function() {
                    // console.log('clusterize timeout');
                    reject(new Error('Clusterize::send timeout, avoid long running invocation if using wait'));
                    delete SESSIONS[message.id];
                }, 3000);

                if (!SESSIONS[message.id]) {
                    SESSIONS[message.id] = {
                        resolve: resolve,
                        reject: reject,
                        timeout: timeout,
                        result: {},
                        error: {},
                        resultCount: 0,
                        errorCount: 0
                    };
                }
            }

            process.send(message);
        });
    }
};

clusterize.on = function(topic, callback) {
    "use strict";

    if (cluster.isWorker) {
        CALLBACKS[topic] = CALLBACKS[topic] || [];
        CALLBACKS[topic].push(callback);
    }
};

clusterize.setDefaultHandler = function(o) {
    "use strict";

    HANDLER = o;
};