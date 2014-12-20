/**
 * yesbee context
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
var EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    Route = require('./route'),
    Producer = require('./producer'),
    Consumer = require('./consumer'),
    logger = require('./logger'),
    util = require('./util');

/**
 * Context is base class for two different type of services
 * - route context service
 * - application service
 */
var Context = function(container, name) {
    "use strict";

    Object.defineProperties(this, {
        clazz: {
            value: '$context',
            enumerable: true,
            writable: false,
            configurable: false
        },
        id: {
            value: Context.generateId(),
            enumerable: true,
            writable: false,
            configurable: false
        },
        name: {
            value: name,
            enumerable: true,
            writable: false,
            configurable: false
        },
        container: {
            value: container
        },
        status: {
            value: 0,
            enumerable: true,
            writable: true,
            configurable: false
        },
        // trace: {
        //     value: false,
        //     enumerable: true,
        //     writable: true,
        //     configurable: false
        // },
        routes: {
            value: {},
            enumerable: false,
            writable: true,
            configurable: false
        },
        producers: {
            value: [],
            enumerable: false,
            writable: true,
            configurable: false
        },
        consumers: {
            value: [],
            enumerable: false,
            writable: true,
            configurable: false
        }
    });

    // define properties later after the context mandatory field is defined
    Object.defineProperties(this, {
        LOG: {
            value: logger(this)
        }
    });

};

/**
 * Static method to generate id for new instance of context
 * @return string unique id of context
 */
Context.ID = 0;

Context.generateId = function() {
    // use simple id instead of uuid
    return 'context:' + Context.ID++;
    // return 'context:' + uuid.v1();
};

/**
 * Context extend EventEmitter
 */
inherits(Context, EventEmitter);

// Context.prototype.setTrace = function(trace) {
//     this.trace = trace;
// };

Context.prototype.from = function(uri, options) {
    var route = new Route(this);
    this.routes[route.id] = route;
    route.from(uri, options);

    return route;
};

Context.prototype.start = function() {
    "use strict";

    // prevent starting more than once
    if (this.status) {
        return;
    }

    var key;
    for (key in this.routes) {
        this.routes[key].start();
    }

    for (key in this.producers) {
        this.producers[key].start();
    }

    for (key in this.consumers) {
        this.consumers[key].start();
    }

    this.status = 1;

    setImmediate(function() {
        this.emit('started');
    }.bind(this));
};

Context.prototype.stop = function() {
    // prevent stopping more than once
    if (!this.status) {
        return;
    }

    var key;
    for (key in this.routes) {
        this.routes[key].stop();
    }

    for (key in this.producers) {
        this.producers[key].stop();
    }

    for (key in this.consumers) {
        this.consumers[key].stop();
    }

    this.status = 0;

    setImmediate(function() {
        this.emit('stopped');
    }.bind(this));
};

Context.prototype.createProducer = function() {
    "use strict";

    var template = new Producer(this.container);

    if (this.status === 1) {
        template.start();
    }

    this.producers.push(template);

    return template;
};

Context.prototype.createConsumer = function() {
    "use strict";

    var template = new Consumer(this.container);

    if (this.status === 1) {
        template.start();
    }

    this.consumers.push(template);

    return template;
};

Context.create = function(name, plugin, container) {
    "use strict";

    var context = new Context(container, name);

    if (typeof plugin == 'function') {
        context.initialize = plugin;
    } else {
        util.arrayMerge(context, plugin);
    }

    context.initialize(container);

    // context.setTrace(context.trace);

    return context;
};

Context.prototype.initialize = function() {
    // noop
};

Context.prototype.test = function(callback) {
    if (this.container.prop('test')) {
        return util.test(this, callback.bind(this));
    }
};

// FIXME refactor this to swarm-like, message should be swarm and know the state
Context.prototype.getService = function(name) {
    return registry.get('services::' + name);
};

Context.prototype.toString = function() {
    return '[Context ' + this.name + ']';
};

module.exports = Context;