/**
 * yesbee messenger
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

var Channel = require('./channel');

var Messenger = function() {
    "use strict";

    this.channels = {};
};

Messenger.prototype.receive = function(uri, receiverFn) {
    "use strict";

    return this.getChannelByUri(uri).getQueue(uri).addReceiver(receiverFn);
};

Messenger.prototype.send = function(uri, message) {
    "use strict";
    // console.log('>> messenger:send', uri);
    var exchange = this.getChannelByUri(uri).getExchange().send(uri, message);
};

Messenger.prototype.getChannelByUri = function(uri) {
    "use strict";

    if (uri[0] === '/') {
        if (!this.channels['']) {
            this.channels[''] = new Channel();
        }
        return this.channels[''];
    } else {
        throw new Error('Unimplemented remote uri yet: ' + uri);
    }
};


module.exports = Messenger;