/**
 * yesbee components/multicast
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

// FIXME revisit this sourcecode later
var aggregation = require('../aggregation');

module.exports = {
    processors: [],

    start: function() {
        this.scopes = {};

        this.constructor.prototype.start.apply(this, arguments);

        this.processors.each(function(processor) {
            processor.start();
        });

    },

    stop: function() {
        this.processors.each(function(processor) {
            processor.stop();
        });

        this.constructor.prototype.stop.apply(this, arguments);
    },

    to: function(o, options) {

        var component = this.context.createComponent(o, options);
        component.route = this;
        this.processors.push(component);

        return this;
    },

    end: function() {
        return this.route;
    },

    setStrategy: function(strategy) {
        if (!strategy) {
            strategy = 'first';
        }

        if (typeof strategy === 'string') {
            strategy = aggregation.getStrategy(strategy);
        }

        this.strategy = strategy;

        return this;
    },

    process: function(message) {

        return util.promise(function(resolve, reject) {
            // TODO ini buat apa ya?
            var replyTo = this.outQueue;

            var scopeData = {
                resolve: resolve,
                reject: reject,
                aggregated: null,
                exchanges: {},
                length: 0,
                completed: 0
            };
            this.addScope(message, scopeData);

            // FIXME revisit this
            this.processors.each(function(processor, id) {
                var whenMessage = message.clone();
                whenMessage.pattern = 'inOut';
                whenMessage.source = this;

                scopeData.exchanges[id] = {
                    id: id,
                    recipient: processor.id,
                    status: false
                };
                scopeData.length++;

                whenMessage.header('multicast-id', id);
                whenMessage.header('multicast-recipient', processor.id);

                setImmediate(function() {
                    this.channel.send(processor.processQueue, whenMessage);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    },

    callback: function(message) {
        var scope = this.scopes[message.property('id')];
        if (scope) {
            if (scope.data.completed < scope.data.length) {
                var id = message.header('multicast-id');
                var recipient = message.header('multicast-recipient');
                var exchangeData = scope.data.exchanges[id];

                message.removeHeader('multicast-id');
                message.removeHeader('multicast-recipient');

                if (exchangeData.status === false) {
                    scope.data.aggregated = this.strategy(scope.data.aggregated, message);
                    exchangeData.status = true;
                    scope.data.completed++;
                }
            }

            // FIXME revisit this
            if (scope.data.completed === scope.data.length) {
                var original = scope.message;
                var aggregated = scope.data.aggregated;
                aggregated.source = original.source;
                aggregated.pattern = original.pattern;
                scope.data.resolve(aggregated);
            }
        }
    }
};