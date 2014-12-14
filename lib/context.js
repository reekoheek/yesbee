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
var Route = require('./route'),
    uuid = require('node-uuid'),
    ProducerTemplate = require('./producer-template'),
    Component = require('./component'),
    registry = require('./registry'),
    channel = require('./channel'),
    Channel = channel.Channel,
    _ = require('lodash'),
    url = require('url'),
    qs = require('querystring'),
    logger = require('./logger'),
    clc = require('cli-color');

/**
 * Context is base class for two different type of services
 * - route context service
 * - application service
 */
var Context = function(container, name) {
    this.clazz = '$context';
    this.id = Context.generateId();
    this.name = name;
    this.status = 0;
    this.routes = {};

    // unused, remove later
    this.trace = false;

    this.producerTemplates = [];

    this.sourceRegistries = {};

    this.container = container;

    this.LOG = logger(this);
    this.TRACE_LOG = logger.create(this, 'trace');
};

/**
 * Static method to generate id for new instance of context
 * @return string unique id of context
 */
Context.ID = 0;

Context.generateId = function() {
    // use simple id instead of uuid
    return 'context-' + Context.ID++;
    // return 'context/' + uuid.v1();
};

Context.prototype.setTrace = function(trace) {
    this.trace = trace;
};

Context.prototype.from = function(uri, options) {
    var route = new Route(this);
    this.routes[route.id] = route;
    route.from(uri, options);

    return route;
};

Context.prototype.start = function() {
    _.each(this.routes, function(route) {
        route.start();
    });

    _.each(this.producerTemplates, function(template) {
        template.start();
    });

    this.status = 1;
};

Context.prototype.stop = function() {
    _.each(this.routes, function(route) {
        route.stop();
    });

    _.each(this.producerTemplates, function(template) {
        template.stop();
    });

    this.status = 0;
};

Context.prototype.createProducerTemplate = function() {
    var template = new ProducerTemplate(this);

    if (this.status === 1) {
        template.start();
    }

    this.producerTemplates.push(template);

    return template;
};

Context.prototype.createComponent = function(o, options) {
    var uri, component, fn;
    if (typeof o == 'function') {
        component = new Component('processor:', options, this);
        component.process = o;
    } else {
        component = new Component(o, options, this);
    }

    return component;
};

Context.prototype.createSourceComponent = function(o, options) {
    var component = this.createComponent(o, options);
    component.type = 'source';

    if (this.sourceRegistries[component.uri]) {
        throw new Error('Component with uri: ' + component.uri + ' already found at registry');
    }

    this.sourceRegistries[component.uri] = component;

    return component;
};

// no test /////////////////////////////////////////////////////////////////////
Context.create = function(name, plugin, container) {
    "use strict";

    try {
        var context = new Context(container, name);

        if (typeof plugin == 'function') {
            context.initialize = plugin;
        } else {
            _.extend(context, plugin);
        }

        context.initialize(container);
        context.setTrace(context.trace);

        return context;
    } catch(e) {
        this.LOG.error('Cannot create context for service "%s"', name, e);
        throw e;
    }
};

Context.prototype.initialize = function() {

};

Context.prototype.lookup = function(o) {
    return this.sourceRegistries[o];
};

Context.prototype.getChannel = function() {
    return channel;
};

Context.prototype.on = function() {
    channel.on.apply(channel, arguments);
};


// FIXME refactor this to swarm-like, exchange should be swarm and know the state
Context.prototype.send = function(channelType, to, exchange, from) {
    var channelId = this.getChannelId(channelType, to);

    var debug = this.container.prop('debug');
    if (this.trace || debug) {
        this.TRACE_LOG.trace({
            type: channelType,
            from: from + '',
            to: to + '',
            origin: (from.route || '') + '',
            channel: channelId,
            exchange: exchange.toString()
        });

        if (debug) {
            this.TRACE_LOG.trace('---------------------------------');
            this.TRACE_LOG.trace(exchange.dump());
            this.TRACE_LOG.trace('+++++++++++++++++++++++++++++++++');
        }
    }

    channel.emit(channelId, exchange);
};

Context.prototype.removeListener = function() {
    channel.removeListener.apply(channel, arguments);
};

Context.prototype.getChannelId = function(type, component) {
    if (type === Channel.SINK) {
        return '::' + type;
    }

    if (typeof component === 'string') {
        component = this.lookup(o);
    }

    if (!component) {
        throw new Error('Channel not found for "undefined" component');
    }

    var contextId = component.context.id || this.id;

    return contextId + '::' + component.id + '::' + type;
};

Context.prototype.getService = function(name) {
    return registry.get('services::' + name);
};

Context.prototype.toString = function() {
    return '[Context ' + this.name + ']';
};
// no test /////////////////////////////////////////////////////////////////////

module.exports = Context;
