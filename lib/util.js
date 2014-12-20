/**
 * yesbee util
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

var stream = require('stream'),
    Q = require('q'),
    pantsPath = require('./path'),
    Mocha;

try {
    Mocha = require('mocha');
} catch(e) {
    // it means no mocha
    mochaErr = e;
}

var isStream = exports.isStream = function(object) {
    "use strict";

    return object instanceof stream.Stream;
};

var isReadableStream = exports.isReadableStream = function(object) {
    "use strict";

    return isStream(object) && object.readable;
};

var isWritableStream = exports.isWritableStream = function(object) {
    "use strict";

    return isStream(object) && object.writable;
};

var createReadableStream = exports.createReadableStream = function(str) {
    "use strict";

    var rs = new stream.Readable();
    rs._read = function() {
        rs.push(str);
        rs.push(null);
    };
    return rs;
};

var sniffContentType = exports.sniffContentType = function(object) {
    "use strict";

    if (isReadableStream(object)) {
        return 'application/octet-stream';
    } else if ('string' === typeof object) {
        return 'text/plain';
    } else {
        return 'application/json';
    }
};

var promise = exports.promise = function(fn) {
    "use strict";

    var defer = Q.defer();
    try {
        var result;

        if (typeof fn !== 'function') {
            defer.resolve(fn);
        } else {
            result = fn.call(this, defer.resolve, defer.reject);
            if (result !== undefined) {
                if (typeof result.then === 'function') {
                    result.then(defer.resolve, defer.reject);
                } else {
                    defer.resolve(result);
                }
            }
        }
    } catch(e) {
        defer.reject(e);
    }

    return defer.promise;
};

var readStream = exports.readStream = function(readable, callback) {
    "use strict";

    var chunks = [];

    var prom = promise(function(resolve, reject) {
        readable.on('data', function(chunk) {
            chunks.push(chunk);
        });

        readable.on('end', function() {
            resolve(Buffer.concat(chunks));
        });

        readable.on('error', function(err) {
            reject(err);
        });
    });

    if (typeof callback === 'function') {
        prom.then(function(data) {
            callback(null, data);
        }, function(err) {
            callback(err);
        }).done();
    } else {
        return prom;
    }


};

var readStreamAsString = exports.readStreamAsString = function(readable, callback) {
    "use strict";

    var prom = readStream(readable)
        .then(function(buffer) {
            return buffer ? buffer.toString() : '';
        });

    if (typeof callback === 'function') {
        prom.then(function(data) {
            callback(null, data);
        }, function(err) {
            callback(err);
        }).done();
    } else {
        return prom;
    }
};

var print = exports.print = function() {
    "use strict";

    console.info.apply(null, arguments);
};

var arrayMerge = exports.arrayMerge = function(arr) {
    "use strict";

    Array.prototype.forEach.call(arguments, function(arg, i) {
        if (i === 0) {
            return;
        }

        for(var j in arg) {
            arr[j] = arg[j];
        }
    });
    return arr;
};

var test = exports.test = function(context, callback) {
    "use strict";

    if (!Mocha) {
        console.error('Testing dependency error: mocha not found');
    }

    if (arguments.length < 2) {
        callback = context;
        context = 'global';
    } else {
        callback = arguments[arguments.length - 1];
    }

    var mocha = new Mocha();

    var suite = {};
    mocha.suite.emit('pre-require', suite, null, mocha);

    return promise(function(resolve) {
        callback(suite);
        setImmediate(function() {
            print('TEST %s:', context);
            mocha.run(function(fail) {
                resolve(fail);
                print('END');
            });
        });
    });
};

var flatten = exports.flatten = function(data) {
    "use strict";

    var result = {};

    var flattenFn_ = function(data, prefixPath) {
        prefixPath = pantsPath.get(prefixPath || []);

        for(var i in data) {
            var p = Array.prototype.slice.call(prefixPath);
            p.push(i);
            p = pantsPath.get(p);
            if (typeof data[i] === 'object' && !(data[i] instanceof Array)) {
                flattenFn_(data[i], p);
            } else {
                result[p.toString()] = data[i];
            }
        }
    };
    flattenFn_(data);

    return result;
};

var escapeUri = exports.escapeUri = function(uri) {
    "use strict";

    return uri.replace(/[\/\\+:@]+/g, '-').toLowerCase();
};