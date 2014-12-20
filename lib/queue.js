/**
 * yesbee queue
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
var Receiver = require('./receiver'),
    inherits = require('util').inherits,
    EventEmitter = require('events').EventEmitter;

var Queue = function(name) {
    "use strict";

    Object.defineProperties(this, {
        clazz: {
            value: 'Queue',
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
        receivers: {
            value: [],
            enumerable: true,
            writable: false,
            configurable: false
        },
        queue: {
            value: [],
            enumerable: true,
            writable: false,
            configurable: false
        },
        drainTimeout_: {
            value: false,
            enumerable: false,
            writable: true,
            configurable: false
        }
    });
};

inherits(Queue, EventEmitter);

Queue.prototype.addReceiver = function(receiverCallback) {
    "use strict";

    var receiver = new Receiver(this, receiverCallback);
    this.receivers.push(receiver);

    this.drain();

    return receiver;
};

Queue.prototype.put = function(message) {
    this.queue.push(message);

    this.emit('put', message);

    this.drain();
};

Queue.prototype.drain = function() {
    if (!this.queue.length || !this.receivers.length) {
        return;
    }



    if (this.drainTimeout_) {
        return;
    }

    this.drainTimeout_ = setTimeout(function() {
        if (this.queue.length && this.receivers.length) {
            var drain_ = function() {
                var message = this.queue.shift();

                var receiver = this.receivers.shift();
                this.receivers.push(receiver);
                receiver.invoke(message);

                if (this.queue.length) {
                    setImmediate(drain_.bind(this));
                } else {
                    this.drainTimeout_ = null;
                }
            }.bind(this);
            drain_();
        }
    }.bind(this), 100);
};

module.exports = Queue;