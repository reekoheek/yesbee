/**
 * yesbee route
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
var Component = require('./component');

var Route = function(context) {
    "use strict";

    Object.defineProperties(this, {
        clazz: {
            value: '$route',
            enumerable: true,
            writable: false,
            configurable: false
        },
        id: {
            value: Route.generateId(),
            enumerable: true,
            writable: false,
            configurable: false
        },
        context: {
            value: context,
            enumerable: false,
            writable: false,
            configurable: false
        }
    });

    this.source = null;
    this.processors = [];
};

Route.ID = 0;

Route.generateId = function() {
    // use simple id instead of uuid
    return 'route:' + Route.ID++;
    // return 'route:' + uuid.v1();
};

Route.prototype.toString = function() {
    return '[Route ' + this.source + ']';
};

Route.prototype.from = function(uri, options) {
    "use strict";

    var component = this.source = Component.createSourceComponent(uri, options, this.context);
    // component.route = this;
    return this;
};

Route.prototype.to = function(uri, options) {
    "use strict";

    var component = Component.create(uri, options, this.context);
    // component.route = this;

    this.processors.push(component);
    return this;
};

Route.prototype.choice = function(name) {
    "use strict";

    var component = Component.create('choice:' + (name || ''), null, this.context);
    // component.route = this;

    this.processors.push(component);
    return component;
};

Route.prototype.multicast = function(strategy) {
    "use strict";

    var component = Component.create('multicast:'/* + uuid.v1()*/, null, this.context)
        .setStrategy(strategy);
    // component.route = this;

    this.processors.push(component);
    return component;
};

Route.prototype.start = function() {
    if (!this.context) {
        throw new Error('Context is missing');
    }

    var processors = this.processors;

    this.source.next = processors[0];

    processors.forEach(function(component, i) {
        var next = processors[i + 1] || null;
        component.next = next;
    });

    this.source.start();

    this.processors.forEach(function(component) {
        component.start();
    });
};

Route.prototype.stop = function() {
    this.source.stop();

    this.processors.forEach(function(component) {
        component.stop();
    });
};

// no test /////////////////////////////////////////////////////////////////////
Route.prototype.query = function(name) {
    if (name === this.source.uri) {
        return this.source;
    }

    this.processors.forEach(function(processor) {
        if (processor.uri == name) {
            return processor;
        }
    });
};

Route.prototype.queryAll = function(name) {
    if (name === this.source.uri) {
        return [this.source];
    }
    return this.processors.filter(function(component) {
        return (component.uri == name);
    });
};
// no test /////////////////////////////////////////////////////////////////////

module.exports = Route;