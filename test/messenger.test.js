/**
 * yesbee test/messenger
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

var assert = require('assert'),
    Messenger = require('../lib/messenger');

describe('Messenger', function() {
    "use strict";

    var messenger = new Messenger();

    describe('constructor', function() {
        it('should return Messenger instance', function() {
            assert(messenger instanceof Messenger);
        });
    });

    describe('#send()', function() {
        it('should be able to send', function() {
            messenger.send('/anu/aja', 'time:' + new Date());
        });

    });

    describe('#receive()', function() {
        var inMessage;
        before(function(done) {
            messenger.receive('/anu/aja', function(message) {
                inMessage = message;
                done();
            });
        });

        it('should be able to receive', function() {
            assert(inMessage);
        });
    });
});