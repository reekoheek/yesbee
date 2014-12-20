/**
 * yesbee test direct_test
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

var assert = require('assert');

module.exports = function(yesbee) {
    "use strict";

    var util = yesbee.require('util'),
        Message = yesbee.require('message');

    this.from('direct:testEcho?exchangePattern=inOut')
        .to(function dua(message, resolve) {
            setTimeout(function() {
                resolve(message);
            });
        });

    this.from('direct:testInOut?exchangePattern=inOut')
        .to(function inOutDua(message, resolve) {
            message.body = 'Hi ' + message.body;
            resolve(message);
        })
        .to(function inOutTiga(message, resolve) {
            message.header('x-custom-header', 'hardcoded');
            resolve(message);
        });

    this.from('direct:testChainedChain')
        .to(function chainedChainDua(message) {
            message.header('x-custom-header', 'hardcoded');
            return message;
        });

    this.from('direct:testChainedInOut?exchangePattern=inOut')
        .to(function(message, resolve) {
            resolve();
        })
        .to('direct:testChainedChain');

    var producer = this.createProducer();
    var context = this;

    // // import the module
    // var mdns = require('mdns');

    // // advertise a http server on port 4321
    // var a = JSON.stringify(yesbee.props);
    // a = a.substr(0, 247);
    // var txtRecord = {};
    // for(var i = 0; i < 40; i++) {
    //     txtRecord['field-' + i] = 'yesbeeee' + i;
    // }
    // var ad = mdns.createAdvertisement(mdns.tcp('yesbee'), 4321, {
    //     txtRecord: txtRecord
    // });
    // ad.start();

    this.on('started', function() {
        this.test(function(suite) {
            suite.describe(this, function() {

                suite.describe('direct:testEcho', function() {
                    var inMessageBody = 'time: ' + new Date(),
                        inMessage = new Message(),
                        outMessage;

                    inMessage.body = inMessageBody;
                    // inMessage.property('exchange-trace', true);

                    suite.before(function producerSend(done) {
                        producer.send('direct:testEcho', inMessage).then(function(message) {
                            outMessage = message;
                        }).then(done, done);
                    });

                    suite.it('should returning the same message body', function() {
                        assert.equal(outMessage.body, inMessageBody);
                    });

                    suite.it('should not having error', function() {
                        assert(!outMessage.error);
                    });

                    suite.it('should having inOnly exchange pattern or empty', function() {
                        var exchangePattern = outMessage.header('exchange-pattern');
                        assert(!exchangePattern || exchangePattern === 'inOnly');
                    });
                });

                suite.describe('direct:testInOut', function() {
                    var inMessage = new Message(),
                        inMessageBody = 'John Doe',
                        outMessage;

                    inMessage.property('exchange-pattern', 'inOut');
                    // inMessage.property('exchange-trace', true);
                    inMessage.body = inMessageBody;

                    suite.before(function producerSend(done) {
                        producer.send('direct:testInOut', inMessage).then(function(message) {
                            outMessage = message;
                        }).then(done, done);
                    });

                    suite.it('should returning message with result body', function() {
                        assert.equal(outMessage.body, 'Hi ' + inMessageBody);
                    });

                    suite.it('should returning message with added header', function() {
                        assert.equal(outMessage.header('x-custom-header'), 'hardcoded');
                    });
                });

                suite.describe('direct:testChainedInOut', function() {
                    var inMessage = new Message(),
                        inMessageBody = 'John Doe',
                        outMessage;

                    inMessage.property('exchange-pattern', 'inOut');
                    // inMessage.property('exchange-trace', true);
                    inMessage.body = inMessageBody;

                    suite.before(function producerSend(done) {
                        producer.send('direct:testChainedInOut', inMessage).then(function(message) {
                            outMessage = message;
                        }).then(done, done);
                    });

                    suite.it('should returning message with added header from chain', function() {
                        assert(outMessage.header('x-custom-header'));
                    });
                });

            });
        });
    });

    // this.on('stopped', function() {
    //     console.timeEnd('direct_test');
    // });
};