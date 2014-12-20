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
    Message = require('./message'),
    Stash = require('./stash'),
    util = require('./util');

var sources = {};

var Component = function(uri, addedOptions, context) {
    "use strict";

    var type, parsed;

    if (arguments.length < 1) {
        throw new Error('Component should have uri and (optional) options');
    }

    if (typeof uri === 'function') {
        this.process = uri;
        uri = 'processor:' + (uri.name || '-');
    } else if (typeof uri !== 'string') {
        throw new Error('Component uri argument must be string');
    }

    uri = uri.trim();
    if (uri.match(':')) {
        var splitted = uri.split(':');
        type = splitted[0];
    }

    // test type of protocol should be valid protocol registered
    if (!type) {
        throw new Error('Unparsed protocol from uri: "' + uri + '".');
    }

    parsed = url.parse(uri);

    var options = qs.parse(parsed.query);
    var search = parsed.search || '';

    uri = uri.substr(0, uri.length - search.length);

    // set default
    var defaultOptions = {
        exchangePattern: 'inOnly',
        timeout: 10000
    };

    Object.defineProperties(this, {
        clazz: {
            value: '$component',
            enumerable: true,
            writable: false,
            configurable: false
        },
        componentClass: {
            value: type,
            enumerable: true,
            writable: true,
            configurable: false
        },
        id: {
            value: Component.generateId(),
            enumerable: true,
            writable: false,
            configurable: false
        },
        type: {
            value: 'processor',
            enumerable: true,
            writable: true,
            configurable: false
        },
        uri: {
            value: uri,
            enumerable: true,
            writable: false,
            configurable: false
        },
        options: {
            value: util.arrayMerge(defaultOptions, options || {}, addedOptions),
            enumerable: true,
            writable: true,
            configurable: false
        },
        status: {
            value: 0,
            enumerable: true,
            writable: true,
            configurable: false
        },
        context: {
            value: context,
            enumerable: false,
            writable: false,
            configurable: false
        },
        next: {
            value: null,
            enumerable: false,
            writable: true,
            configurable: false
        },
        messenger: {
            value: context.container.messenger,
            enumerable: false,
            writable: false,
            configurable: false,
        },
        receivers: {
            value: [],
            enumerable: false,
            writable: true,
            configurable: false,
        }
    });

    var uriSuffix = util.escapeUri(this.uri),
        longUriSuffix = uriSuffix + '/' + context.container.prop('workerName');
    Object.defineProperties(this, {
        inQueue: {
            value: '/in/' + uriSuffix,
            enumerable: false,
            writable: false,
            configurable: false
        },
        processQueue: {
            value: '/q/' + longUriSuffix,
            enumerable: false,
            writable: false,
            configurable: false
        },
        outQueue: {
            value: '/out/' + longUriSuffix,
            enumerable: false,
            writable: false,
            configurable: false
        },
        stash: {
            value: new Stash(),
            enumerable: false,
            writable: true,
            configurable: false
        },
        LOG: {
            value: logger(context),
            enumerable: false,
            writable: false,
            configurable: false
        }
    });
};

Component.ID = 0;
Component.PROCESSOR_ID = 0;
Component.registry = {};

Component.generateId = function() {
    // use simple id instead of uuid
    return 'component:' + Component.ID++;
    // return 'component:' + uuid.v1();
};

Component.register = function(name, plugin, container) {
    this.registry[name + ':'] = plugin;
};

Component.create = function(uriOrFn, options, context) {
    "use strict";

    var component = new Component(uriOrFn, options, context),
        plugin = Component.registry[component.componentClass + ':'];

    if (!plugin) {
        throw new Error('Component for protocol "' + component.type + '" not found.');
    }

    if (typeof plugin == 'function') {
        component.initialize = plugin;
    } else {
        util.arrayMerge(component, plugin);
    }

    component.initialize(context.container);

    return component;
};

Component.createSourceComponent = function(uri, options, context) {
    "use strict";

    var component = Component.create(uri, options, context);
    component.type = 'source';

    if (sources[component.uri]) {
        throw new Error('Source with uri: ' + component.uri + ' already found, cannot redeclare source component.');
    }

    sources[component.uri] = component;

    return component;
};

Component.prototype.start = function() {
    if (!this.context) {
        throw new Error('Cannot start from detached component from context');
    }

    this.startReceiving();

    this.stash.reset();

    this.status = 1;
};

Component.prototype.stop = function() {
    this.status = 0;

    this.stash.popAll();

    this.stopReceiving();
};

Component.prototype.startReceiving = function() {
    var receiver;
    receiver = this.messenger.receive(this.inQueue, this.consume_.bind(this));
    this.receivers.push(receiver);

    receiver = this.messenger.receive(this.processQueue, this.process_.bind(this));
    this.receivers.push(receiver);

    receiver = this.messenger.receive(this.outQueue, this.callback_.bind(this));
    this.receivers.push(receiver);
};

Component.prototype.stopReceiving = function() {
    this.receivers.forEach(function(receiver, index) {
        receiver.close();
    });
    this.receivers.splice(0);
};

Component.prototype.consume = function(message) {
    return message;
};

Component.prototype.process = function(message) {
    return message;
};

Component.prototype.callback = function(message) {
    return message;
};

Component.prototype.initialize = function(message) {
    // noop
};

Component.prototype.getNext = function(message) {
    return this.next;
};

Component.prototype.consume_ = function(message) {
    "use strict";

    util.promise(
        // prepare inbound data
        function(resolve, reject) {
            message.property('exchange-pattern', this.options.exchangePattern);

            var replyTo = message.property('reply-to');
            if (message.property('exchange-pattern') === 'inOnly') {
                if (replyTo) {
                    this.messenger.send(replyTo, message);
                }
            }
            resolve(message);
        }.bind(this)
    ).then(
        // invoke consume process
        function(message) {
            return util.promise(function(resolve, reject) {
                return this.consume(message, resolve, reject);
            }.bind(this));
        }.bind(this)
    ).then(
        // send next if success
        function(messageOrBody) {
            message = this.prepareMessage(message, messageOrBody);
            this.sendNext(message);
        }.bind(this),
        // log error if not
        function(e) {
            this.LOG.error('ProcessError: %s', e.message, e);
        }.bind(this)
    ).done();
};

Component.prototype.prepareMessage = function(originalMessage, messageOrBody) {
    if (messageOrBody instanceof Message) {
        originalMessage = messageOrBody;
    } else if (messageOrBody !== undefined) {
        originalMessage.body = messageOrBody;
    }
    return originalMessage;
};

Component.prototype.process_ = function(message) {
    "use strict";

    util.promise(
        // process message
        function(resolve, reject) {
            return this.process(message, resolve, reject);
        }.bind(this)
    ).then(
        // intuitively modify message and send next
        function(messageOrBody) {
            message = this.prepareMessage(message, messageOrBody);
            this.sendNext(message);
        }.bind(this),
        // on fail send message with error (and log ofcourse)
        function(e) {
            message.error = e;
            this.sendNext(message);
            this.LOG.error('ProcessError: %s', e.message, e);
        }.bind(this)
    ).done();
};

Component.prototype.callback_ = function(message) {
    "use strict";

    util.promise(
        function(resolve, reject) {
            return this.callback(message, resolve, reject);
        }.bind(this)
    ).then(
        function(messageOrBody) {
            message = this.prepareMessage(message, messageOrBody);
            this.stash.pop(message);
        }.bind(this),
        function(e) {
            this.LOG.error('CallbackError: %s', e.message, e);
        }.bind(this)
    ).done();
};

Component.prototype.sendOutbound = function(uri, message) {
    "use strict";

    if (!(message instanceof Message)) {
        var body = message;
        message = new Message();
        message.body = body;
    }

    var outboundMessage = message.clone(true);

    outboundMessage.property({
        'exchange-from': this.uri,
        'reply-to': this.outQueue
    });

    return util.promise(function(resolve, reject) {
        this.stash.push(message, resolve, reject);
        this.messenger.send('/in/' + util.escapeUri(uri), outboundMessage);
    }.bind(this));
};

Component.prototype.sendNext = function(message) {

    if (!(message instanceof Message)) {
        throw new Error('Argument should be an Message instance');
    }

    var to = this.getNext(message);

    message.property('exchange-from', this.uri);

    if (to && !message.error) {
        return this.messenger.send(to.processQueue, message);
    } else {
        var replyTo = message.property('reply-to');
        if (replyTo && message.property('exchange-pattern') === 'inOut') {
            if (!message.error || message.error.clazz !== '$timeouterror') {
                // try using reply-to, i think it is safe
                this.messenger.send(message.property('reply-to'), message);
            } else {
                this.LOG.warn('Prevent send message since it is already timeout. I think you should not see this anyway');
            }
        } else {
            // noop
            // this.messenger.send('/sink', message);
        }
    }
};

// no test /////////////////////////////////////////////////////////////////////
Component.prototype.toString = function() {
    return '[Component#' + (this.type[0] || '').toUpperCase() + ' ' + this.uri + ']';
};

module.exports = Component;