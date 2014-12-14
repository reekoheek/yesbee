/**
 * yesbee component
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
var url = require('url'),
    qs = require('querystring'),
    // uuid = require('node-uuid'),
    logger = require('./logger'),
    _ = require('lodash'),
    Exchange = require('./exchange'),
    channel = require('./channel'),
    Channel = channel.Channel,
    util = require('./util');

var timeoutError = new Error('Timeout executing route');
timeoutError.clazz = '$timeouterror';

var Component = function(uri, options, context) {
    if (arguments.length < 1) {
        throw new Error('Component should have uri and (optional) options');
    }

    if (typeof uri !== 'string') {
        throw new Error('Component uri argument must be string');
    }

    this.clazz = '$component';
    this.componentClass = null;
    this.type = 'processor';

    this.id = Component.generateId();
    this.uri = null;
    this.scopes = {};

    this.status = 0;

    this.route = null;
    this.next = null;

    this.doInit(uri, options);

    this.context = context;
    this.LOG = logger(this.context);
};

Component.ID = 0;
Component.PROCESSOR_ID = 0;
Component.registry = {};

Component.generateId = function() {
    // use simple id instead of uuid
    return 'component-' + Component.ID++;
    // return 'component/' + uuid.v1();
};

Component.register = function(name, plugin, container) {
    if (typeof plugin === 'function') {
        plugin = {
            initialize: plugin
        };
    }

    plugin.container = container;

    this.registry[name + ':'] = plugin;
};

Component.prototype.start = function() {
    if (!this.context) {
        throw new Error('Cannot start from detached component from context');
    }

    this.startListening();

    this.scopes = {};
    this.status = 1;
};

Component.prototype.stop = function() {
    this.status = 0;

    this.stopListening();
};

Component.prototype.startListening = function() {
    var that = this;

    _.each(this.getChannelDescriptors(), function(channel) {
        that.context.on(channel.id, channel.listener);
    });
};

Component.prototype.stopListening = function() {
    var that = this;

    _.each(this.getChannelDescriptors(), function(channel) {
        that.context.removeListener(channel.id, channel.listener);
    });

    delete this.channelDescriptors;
};

Component.prototype.process = function(exchange) {
    return exchange;
};

Component.prototype.send = function(channelType, to, exchange) {
    if (!this.context) {
        throw new Error('Cannot send from detached component from context');
    }

    this.context.send(channelType, to, exchange, this);
};

Component.prototype.callback = function(exchange) {
    return exchange;
};

Component.prototype.initialize = function(exchange) {
    // noop
};

Component.prototype.getNext = function(exchange) {
    return this.next;
};

Component.prototype.doInit = function(uri, options) {
    var type, parsed, plugin;

    uri = uri.trim();

    if (uri.match(':')) {
        var splitted = uri.split(':');
        type = splitted[0];
    }

    // test type of protocol should be valid protocol registered
    if (!type) {
        throw new Error('Unparsed protocol from uri: "' + uri + '".');
    }

    plugin = Component.registry[type + ':'];
    if (!plugin) {
        throw new Error('Protocol "' + type + '" not found.');
    }

    // extend object with plugin
    _.extend(this, plugin);


    parsed = url.parse(uri);

    var queryStringOptions = qs.parse(parsed.query);
    var search = parsed.search || '';

    uri = uri.substr(0, uri.length - search.length);

    this.componentClass = type;

    this.uri = uri;


    var defaultOptions = {
        exchangePattern: 'inOnly',
        timeout: 10000 // 30000
    };
    this.options = _.extend(defaultOptions, this.options);
    this.options = _.extend(this.options, queryStringOptions);
    this.options = _.extend(this.options, options);

    this.initialize(this.container);
};

Component.prototype.doProcess = function(exchange) {
    "use strict";

    if (!(exchange instanceof Exchange)) {
        throw new Error('Argument should be an Exchange instance');
    }

    var timeout;

    if (this.type === 'source') {
        var cloneExchange = exchange.clone();

        cloneExchange.source = this;
        cloneExchange.pattern = this.options.exchangePattern;

        exchange = cloneExchange;

        // TODO why inOnly doesnot have callback property
        var callbackChannel = exchange.property('callback');
        if (callbackChannel) {
            if (exchange.pattern === 'inOnly') {
                // TODO should we go to out channel first before emit to callback?
                this.context.getChannel().emit(callbackChannel, exchange);
            } else {
                timeout = setTimeout(function() {
                    this.removeScope(exchange);

                    // TODO why we should check if there is exchange error exists?
                    // if (!exchange.error) {
                    exchange.error = timeoutError;
                    // }

                    this.send(Channel.OUT, this, exchange);

                }.bind(this), this.options.timeout);

                this.addScope(exchange, {
                    timeout: timeout
                });
            }
        }

    }

    // processing can be roughly break, wrap the process on promise land
    // to make sure it will handle exception
    return util.promise(
        function(resolve, reject) {
            var result = this.process(exchange, resolve, reject);
            if (result !== undefined) {
                if (typeof result.then === 'function') {
                    result.then(resolve, reject);
                } else {
                    resolve(result);
                }
            }
        }.bind(this)
    ).then(
        function(newExchange) {
            if (newExchange instanceof Exchange) {
                exchange = newExchange;
            } else if (newExchange !== undefined) {
                exchange.body = newExchange;
            }
            this.doSend(exchange);
        }.bind(this),
        function(e) {
            exchange.error = e;
            this.doSend(exchange);
            throw e;
        }.bind(this)
    );
};

Component.prototype.doCallback = function(exchange) {
    if (!(exchange instanceof Exchange)) {
        throw new Error('Argument should be an Exchange instance');
    }


    var that = this;

    return util.promise(function(resolve, reject) {
            var result = this.callback(exchange, resolve, reject);
            if (result !== undefined) {
                if (typeof result.then === 'function') {
                    result.then(resolve, reject);
                } else {
                    resolve(result);
                }
            }
        }.bind(this))
        .then(function(newExchange) {
            if (newExchange instanceof Exchange) {
                exchange = newExchange;
            } else if (typeof newExchange !== 'undefined') {
                exchange.body = newExchange;
            }


            if (this.type === 'source') {
                var callbackChannel = exchange.property('callback');

                if (callbackChannel) {
                    this.context.getChannel().emit(callbackChannel, exchange);
                }

                if (this.scopes[exchange.id]) {
                    this.removeScope(exchange);
                }
            }
        }.bind(this));
};

Component.prototype.doSend = function(exchange) {

    if (!(exchange instanceof Exchange)) {
        throw new Error('Argument should be an Exchange instance');
    }

    var to = this.getNext(exchange),
        channel;

    if (to && !exchange.error) {
        return this.send(Channel.IN, to, exchange);
    } else {
        to = exchange.source;
        if (to && exchange.pattern == 'inOut') {
            if (exchange.error !== timeoutError) {
                this.send(Channel.OUT, to, exchange);
            } else {
                this.LOG.warn('Prevent send exchange since it is already timeout');
            }
        } else {
            this.context.send(Channel.SINK, null, exchange, this);
        }

        exchange.finish = true;
    }

};

// no test /////////////////////////////////////////////////////////////////////
Component.prototype.toString = function() {
    return '[Component#' + (this.type[0] || '').toUpperCase() + ' ' + this.uri + ']';
};

Component.prototype.getChannelDescriptors = function() {
    var that = this;
    if (!this.channelDescriptors) {
        this.channelDescriptors =  [
            {
                id: this.getChannelId(Channel.IN),
                listener: function(exchange) {
                    util.promise(function(resolve, reject) {
                        return that.doProcess(exchange);
                    }).then(null, function(e) {
                        that.LOG.error('ProcessError: %s', e.message, e);
                    }).done();
                }
            },
            {
                id: this.getChannelId(Channel.OUT),
                listener: function(exchange) {
                    util.promise(function(resolve, reject) {
                        return that.doCallback(exchange);
                    }).then(null, function(e) {
                        that.LOG.error('CallbackError: %s', e.message, e);
                    }).done();
                }
            }
        ];
    }

    return this.channelDescriptors;
};

Component.prototype.getChannelId = function(type) {
    if (!this.context) {
        throw new Error('Cannot found channel id for null context');
    }
    return this.context.getChannelId(type, this);
};

Component.prototype.addScope = function(exchange, data) {
    this.scopes[exchange.id] = {
        exchange: exchange,
        data: data || {}
    };
};

Component.prototype.removeScope = function(exchange) {
    if (this.scopes[exchange.id]) {
        if (this.scopes[exchange.id].data.timeout) {
            clearTimeout(this.scopes[exchange.id].data.timeout);
        }
        delete this.scopes[exchange.id];
    }
};

module.exports = Component;