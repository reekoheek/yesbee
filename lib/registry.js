/**
 * yesbee registry
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

var Host = function() {
    "use strict";

    this.data = {};
};

Host.prototype.put = function(k, v) {
    "use strict";

    this.data[k] = v;
};

Host.prototype.get = function(k) {
    "use strict";

    return this.data[k] || null;
};

Host.prototype.find = function(k) {
    "use strict";

    var result = {};
    var regex = k.replace(/\*/g, '[^/]+').replace(/#/g, '.+');
    var r = new RegExp(regex);
    for(var i in this.data) {
        if (r.test(i)) {
            result[i] = this.data[i];
        }
    }

    return result;
};

var Registry = function(options) {
    "use strict";

    assert(options.name);

    this.clazz = '$registry';

    this.name = options.name;
    this.hosts = {};
};

Registry.prototype.put = function(k, v) {
    "use strict";

    this.getHost(this.name).put(k, v);
};

Registry.prototype.getHost = function(name) {
    "use strict";

    if (!this.hosts[name]) {
        this.hosts[name] = new Host(name);
    }
    return this.hosts[name];
};

Registry.prototype.get = function(k) {
    "use strict";

    return this.getHost(this.name).get(k);
};

Registry.prototype.find = function(k) {
    "use strict";

    return this.getHost(this.name).find(k);

    // if (typeof k !== 'string') {
    //     throw new Error('First argument should be string');
    // }

    // var segments = k.split('::'),
    //     sk = segments.map(function(segment) {
    //         if (segment === '*') {
    //             return '((?!::).)*';
    //         }
    //         return segment;
    //     });

    // var regex = '^' + sk.join('::') + '$',
    //     result;

    // for(var i in this.data) {
    //     var match = (new RegExp(regex, 'g')).test(i);
    //     if (match) {
    //         result = this.data[i];
    //         break;
    //     }
    //     return match;
    // }

    // return result;
};

module.exports = Registry;