/**
 * yesbee message
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
var uuid = require('node-uuid'),
    util = require('./util');

var Message = function(id) {
    "use strict";

    var body_ = null;

    Object.defineProperties(this, {
        clazz: {
            value: '$message',
            enumerable: true,
            writable: false,
            configurable: false
        },
        address: {
            value: '',
            enumerable: true,
            writable: true,
            configurable: false
        },
        properties: {
            value: {
                'id': id || Message.generateId(),
                'correlation-id': null,
                'reply-to': null,
                'data-type': 'object',
            },
            enumerable: true,
            writable: true,
            configurable: false
        },
        headers: {
            value: {
                'content-type': 'application/json'
            },
            enumerable: false,
            writable: true,
            configurable: false
        },
        body: {
            get: function() {
                return body_;
            },
            set: function(body) {
                var contentType = this.header('content-type');
                switch(typeof body) {
                    case 'object':
                        if (body instanceof Buffer) {
                            this.property('data-type', 'buffer');
                            if (!contentType) {
                                this.header('content-type', 'application/octet-stream');
                            }
                        } else if (body.readable) {
                            this.property('data-type', 'stream');
                            if (!contentType) {
                                this.header('content-type', 'application/octet-stream');
                            }
                        } else {
                            this.property('data-type', 'object');
                            if (!contentType) {
                                this.header('content-type', 'application/json');
                            }
                        }
                        break;
                    default:
                        this.property('data-type', 'string');
                        body = body + '';
                        if (!contentType) {
                            this.header('content-type', 'text/plain');
                        }
                }
                body_ = body;
            },
            enumerable: false,
            configurable: false
        },
        error: {
            value: null,
            enumerable: false,
            writable: true,
            configurable: false
        }
    });
};

Message.ID = 0;
Message.generateId = function() {
    "use strict";

    return 'message:' + Message.ID++;
    // return 'message:' + uuid.v1();
};

Message.prototype.getBodyAsObject = function(callback) {
    "use strict";

    return this.getBodyAsString().then(function(data) {
        return JSON.parse(data);
    });
};

Message.prototype.getBodyAsString = function(callback) {
    "use strict";

    var promise = util.promise(function(resolve, reject) {
            switch(this.contentType) {
                case 'application/json':
                    try {
                        return JSON.stringify(this.body);
                    } catch(e) {
                        throw new Error('Message#getBodyAsString stringify error, ' + e.message);
                    }
                    break;
                case 'application/octet-stream':
                    return util.readStreamAsString(this.body)
                        .then(function(body) {
                            this.body = body;
                            return body;
                        }.bind(this));
                default:
                    return typeof this.body === 'string' ? this.body : (this.body + '');
            }
        }.bind(this));

    if (typeof callback === 'function') {
        promise.then(function(result) {
            callback(null, result);
        }, function(e) {
            console.error('err', e);
            callback(e);
        });
    } else {
        return promise;
    }
};

Message.prototype.getBodyAsStream = function(callback) {
    "use strict";

    var promise = util.promise(function(resolve, reject) {
        return this.getBodyAsString().then(function(body) {
            return util.createReadableStream(body);
        });
    }.bind(this));

    if (typeof callback === 'function') {
        promise.then(function(result) {
            callback(null, result);
        }, function(e) {
            callback(e);
        });
    } else {
        return promise;
    }
};

Message.prototype.header = function(key, value) {
    "use strict";

    if (arguments.length > 1) {
        this.headers[key] = value;
        return this;
    } else if (arguments.length === 0) {
        return this.headers;
    } else if (typeof key == 'string') {
        return this.headers[key];
    } else {
        for(var i in key) {
            this.header(i, key[i]);
        }
        return this;
    }

    // var i;
    // if (arguments.length > 1) {
    //     this.headers[key] = value;
    // } else if (arguments.length === 0) {
    //     return this.headers;
    // } else if (typeof key === 'string') {
    //     if (key.indexOf('::') === -1) {
    //         var ns = key + '::';
    //         var result = {};
    //         for(i in this.headers) {
    //             if (i.indexOf(ns) === 0) {
    //                 result[i] = this.headers[i];
    //             }
    //         }
    //         return result;
    //     } else {
    //         return this.headers[key];
    //     }
    // } else {
    //     for(i in key) {
    //         this.header(i, key[i]);
    //     }
    // }
};

Message.prototype.removeHeader = function(key) {
    "use strict";

    if (key.indexOf('::') === -1) {
        var ns = key + '::';
        for(var i in this.headers) {
            if (i.indexOf(ns) === 0) {
                delete this.headers[i];
            }
        }
    } else if (typeof this.headers[key] !== 'undefined') {
        delete this.headers[key];
    }
    return this;
};

Message.prototype.property = function(key, value) {
    "use strict";

    if (arguments.length > 1) {
        this.properties[key] = value;
        return this;
    } else if (arguments.length === 0) {
        return this.properties;
    } else if (typeof key == 'string') {
        return this.properties[key];
    } else {
        for(var i in key) {
            this.property(i, key[i]);
        }
        return this;
    }
};

Message.prototype.toString = function() {
    "use strict";

    return '[Message ' + this.property('id') + (this.error ? ' with error' : '') + ']';
};

Message.prototype.clone = function(isNewId) {
    "use strict";

    var message = new Message(isNewId ? null : this.property('id'));

    Object.getOwnPropertyNames(this).forEach(function(propertyName) {
        switch(propertyName) {
            case 'clazz':
                break;
            case 'properties':
            case 'headers':
                Object.getOwnPropertyNames(this[propertyName]).forEach(function(k) {
                    if (k === 'id') {
                        return;
                    }
                    message[propertyName][k] = this[propertyName][k];
                }.bind(this));
                break;
            default:
                message[propertyName] = this[propertyName];
        }
    }.bind(this));

    message.property('correlation-id', this.property('id'));

    return message;
};

Message.prototype.copyFrom = function(message) {
    var i;
    for(i in message.headers) {
        this.headers[i] = message.headers[i];
    }

    this.body = message.body;

    return this;
};

Message.prototype.dump = function() {
    return {
        'clazz': this.clazz,
        'properties': this.properties,
        'headers': this.headers,
        'body': '[' + this.property('data-type') + ']',
        'error': this.error ? this.error + '' : null
    };
};

// Message.prototype.toJSON = function() {
//     return JSON.stringify({
//         properties: this.properties,
//         headers: this.headers,
//         body: this.body,
//         error: this.error || null
//     });
// };

module.exports = Message;