/**
 * yesbee stash
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

var Message = require('./message'),
    util = require('./util');


var Stash = function(options) {
    this.options = {
        timeout: 10000
    };
    if (options) {
        this.options = util.arrayMerge(this.options, options);
    }
    this.envelopes = {};
};

var timeoutError = new Error('Timeout executing route');
timeoutError.clazz = '$timeouterror';

Stash.prototype.reset = function() {
    this.envelopes = {};
};

Stash.prototype.push = function(message, resolve, reject) {
    var envelope = {
        message: message,
        resolve: resolve,
        reject: reject
    };

    if (this.options.timeout) {
        envelope.timeout = setTimeout(function() {
            // console.log('stash timeout');
            message.error = timeoutError;
            this.pop(message);
        }.bind(this), this.options.timeout);
    }

    this.envelopes[message.property('id')] = envelope;
    return this;
};

Stash.prototype.pop = function(message) {
    var foundEnvelopes = [],
        envelope;

    envelope = this.envelopes[message.property('id')];
    if (envelope) {
        foundEnvelopes.push(envelope);
    }

    if (message.property('correlation-id')) {
        envelope = this.envelopes[message.property('correlation-id')];
        if (envelope) {
            foundEnvelopes.push(envelope);
        }
    }

    if (!foundEnvelopes.length) {
        console.error('pop:' + foundEnvelopes.length);
    }

    foundEnvelopes.forEach(function(envelope) {

        if (envelope.timeout) {
            clearTimeout(envelope.timeout);
        }

        if (envelope.message.property('exchange-pattern') === 'inOut') {
            message = envelope.message.copyFrom(message);
        } else {
            message = envelope.message;
        }
        envelope.resolve(message);

        delete this.envelopes[envelope.message.property('id')];
    }.bind(this));

    return message;
};

Stash.prototype.popAll = function() {
    for(var i in this.envelopes) {
        var message = this.envelopes[i];
        this.pop(message);
    }
};

module.exports = Stash;