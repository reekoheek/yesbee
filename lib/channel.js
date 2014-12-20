/**
 * yesbee channel
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
var logger = require('./logger'),
    Exchange = require('./exchange'),
    Message = require('./message'),
    Queue = require('./queue');

var Channel = function() {
    "use strict";

    this.exchanges = {};
    this.queues = {};
    this.LOG = logger.create('channel', 'trace');
};

Channel.prototype.getExchange = function(name) {
    "use strict";

    name = name || '';
    if (!this.exchanges[name]) {
        var exchange = this.exchanges[name] = this.createExchange(name);
    }

    return this.exchanges[name];
};

Channel.prototype.createExchange = function(name) {
    var exchange = new Exchange(name);
    exchange.on('ready', this.onExchangeReady_.bind(this));
    return exchange;
};

Channel.prototype.createQueue = function(name) {
    var queue = new Queue(name);
    queue.on('put', this.onQueuePut_.bind(this));
    return queue;
};

// var onExchangeReady_t = null;
Channel.prototype.onExchangeReady_ = function(exchange) {
    "use strict";
    if (exchange.name === '') {
        while (exchange.outgoing.length) {
            var message = exchange.outgoing.shift();
            this.getQueue(message.address).put(message);
        }
    } else {
        throw new Error('Unimplemented exchange data');
    }
};

Channel.prototype.onQueuePut_ = function(message) {
    "use strict";

    if (message.property('exchange-trace')) {
        this.LOG.trace(
            {
                queue: message.address,
                message: message
            }
        );
    }
};

Channel.prototype.getQueue = function(name) {
    "use strict";
    if (!this.queues[name]) {
        var queue = this.queues[name] = this.createQueue(name);
    }

    return this.queues[name];
};

module.exports = Channel;