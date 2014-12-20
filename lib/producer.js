/**
 * yesbee producer
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
    Stash = require('./stash'),
    util = require('./util');

var Producer = function(container) {
    "use strict";

    this.id = Producer.generateId();
    this.uri = 'urn:' + this.id;
    this.replyTo = '/out/' + util.escapeUri(this.uri) + '/' + container.prop('workerName');
    this.status = 0;

    this.stash = new Stash();

    this.messenger = container.messenger;

    this.receivers = [];
};

Producer.ID = 0;

Producer.generateId = function() {
    "use strict";

    return 'producer:' + Producer.ID++;
};

Producer.prototype.start = function() {
    "use strict";

    this.stash.reset();

    this.receivers.push(this.messenger.receive(this.replyTo, this.callback.bind(this)));

    this.status = 1;
};

Producer.prototype.stop = function() {
    "use strict";

    this.status = 0;

    this.receivers.forEach(function(receiver, index) {
        receiver.close();
    });
    this.receivers.splice(0);

    this.stash.popAll();
};

Producer.prototype.send = function(uri, message) {
    "use strict";

    if (!(message instanceof Message)) {
        var body = message;
        message = new Message();
        message.body = body;
    }

    var outboundMessage = message.clone(true);

    outboundMessage.property({
        'exchange-from': this.uri,
        'reply-to': this.replyTo
    });

    return util.promise(function(resolve, reject) {
        this.stash.push(message, resolve, reject);
        this.messenger.send('/in/' + util.escapeUri(uri), outboundMessage);
    }.bind(this));
};

Producer.prototype.callback = function(message) {
    "use strict";

    this.stash.pop(message);
};

Producer.prototype.toString = function() {
    "use strict";

    return '[Producer ' + this.id + ']';
};

module.exports = Producer;