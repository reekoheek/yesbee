/**
 * yesbee components/choice
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
var util = require('../util');

module.exports = {
    processors: [],

    start: function() {
        this.constructor.prototype.start.apply(this, arguments);

        this.processors.each(function(processor) {
            processor.component.start();
        });

    },

    stop: function() {
        this.processors.each(function(processor) {
            processor.component.stop();
        });

        this.constructor.prototype.stop.apply(this, arguments);
    },

    when: function(expression) {
        if (this.endOfRules) {
            throw new Error('Cannot set when/otherwise after rules end');
        }
        this.processors.push({
            expression: expression,
            component: null
        });

        return this;
    },

    otherwise: function() {
        var result = this.when(function() { return true; });
        this.endOfRules = true;
        return result;
    },

    end: function() {
        return this.route;
    },

    to: function(o, options) {
        var last = this.processors[this.processors.length - 1];
        if (!last) {
            throw new Error('No context for new when/otherwise route');

        }

        var component = this.context.createComponent(o, options);
        component.route = this.route;

        last.component = component;

        return this;
    },

    // FIXME visit this immediately later
    process: function(message) {

        return util.promise(function(resolve, reject) {
            var processor;

            for(var i in this.processors) {
                if (this.processors[i].expression(message)) {
                    processor = this.processors[i];
                    break;
                }
            }

            var to = processor.component;

            this.addScope(message, {
                resolve: resolve,
                reject: reject
            });

            var whenMessage = message.clone();
            whenMessage.property({
                'exchange-reply-to': this.outQueue,
                'exchange-pattern': 'inOut'
            });

            this.channel.send(to.processQueue, whenMessage);
        });
    },

    // FIXME revisit this immediately later
    callback: function(message) {
        var scope = this.scopes[message.property('id')];
        if (scope) {
            var original = scope.message;

            message.property({
                'exchange-source': original.property('source'),
                'exchange-pattern': original.property('exchange-pattern'),
            });

            scope.data.resolve(message);
        }
    }
};