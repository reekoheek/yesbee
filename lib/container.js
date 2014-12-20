/**
 * yesbee container
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
var fs = require('fs'),
    Context = require('./context'),
    Component = require('./component'),
    Messenger = require('./messenger'),
    path = require('path'),
    logger = require('./logger'),
    registry = require('./registry'),
    Server = require('./server'),
    Table = require('easy-table'),
    uuid = require('node-uuid'),
    util = require('./util'),
    pantsPath = require('./path');

/**
 * Container
 * @param {string} containerPath
 */
var Container = function(manifest) {
    var manifestFile,
        moduleDir = path.resolve('./node_modules');

    // init scope map
    this.scopes = {};

    // default props
    this.props = {
        name: 'yesbee',
        workerId: '0',
        workerName: null,
        container: path.resolve('.'),
        dependencies: [],
        host: '127.0.0.1',
        port: 9999,
        autostart: [],
        debug: false
    };

    this.prop(manifest);

    logger.prop({
        id: this.props.workerId || 1,
        debug: this.prop('debug'),
    });

    // populate scopes
    this.addScope(__dirname);
    if (fs.existsSync(moduleDir)) {
        fs.readdirSync(moduleDir).forEach(function(f) {
            if (f.indexOf('yesbee-') === 0) {
                this.addScope(path.resolve(moduleDir, f));
            }
        }.bind(this));
    }

    // add scope dependencies
    if (this.props.dependencies) {
        this.props.dependencies.forEach(function(dep) {
            this.addScope(dep);
        }.bind(this));
    }

    // add prop/container as scope
    this.addScope(this.prop('container'));

    this.messenger = new Messenger(this);

    this.logger = logger;
};

/**
 * Container#addScope
 * @param {string} rootDir Root directory for the new scope
 *
 * @return {Container} to be chained
 */
Container.prototype.addScope = function(rootDir) {
    rootDir = rootDir.trim();
    this.scopes[rootDir] = rootDir;
    return this;
};

Container.prototype.getScopes = function() {

    return Object.keys(this.scopes);

};

/**
 * Getter/setter for prop
 * @param  {var} arg1
 * @param  {var} arg2
 * @return {var}
 */
Container.prototype.prop = function(propName, propValue) {
    if (propName === null) {
        this.props = {};
    } else if (typeof propName === 'object') {
        for(var i in propName) {
            this.prop(i, propName[i]);
        }
    } else {
        if (arguments.length === 1) {
            try {
                return pantsPath(this.props).get(propName);
            } catch(e) {
                return;
            }
        } else {
            pantsPath(this.props).set(propName, propValue);
        }
    }
};

Container.prototype.populate = function(type) {
    var dir = type + 's',
        scripts = [];

    this.getScopes().forEach(function(scope) {
        var scopeDir = path.resolve(scope, dir);

        if (!fs.existsSync(scopeDir)) {
            return;
        }

        fs.readdirSync(scopeDir).forEach(function(file) {
            var ext = path.extname(file),
                name = path.basename(file, ext);
            if (ext === '.js' || ext === '.node') {
                scripts[name] = path.resolve(scopeDir, name);
            }
        });
    });

    return scripts;
};

Container.prototype.get = function(key) {

    return registry.get(key);

};

Container.prototype.put = function(key, value) {

    return registry.put(key, value);

};

Container.prototype.find = function(selector) {

    return registry.find(selector);

};

var messages = {};

Container.prototype.send = function(method) {

    var messageId = uuid.v1();

    return util.promise(function(resolve, reject) {
        messages[messageId] = {
            resolve: resolve,
            reject: reject,
            time: new Date()
        };

        process.send({
            id: messageId,
            method: method,
            arguments: Array.prototype.slice.call(arguments, 1)
        });
    });
};

Container.prototype.reply = function(reply) {
    var result = {};
    reply.reply.forEach(function(rep) {
        result[rep.destination] = rep.result;
    });
    messages[reply.id].resolve(result);
};

Container.prototype.remoteStartService = function(serviceName) {
    try {
        this.get('services::' + serviceName).start();
    } catch(e) {

    }
};

Container.prototype.remoteStopService = function(serviceName) {
    try {
        this.get('services::' + serviceName).stop();
    } catch(e) {

    }
};

Container.prototype.remoteGetAllServices = function() {
    var services = [];
    registry.find('services::*').forEach(function(service) {
        services.push({
            name: service.name,
            status: service.status
        });
    });

    return services;
};

Container.prototype.populateComponents = function() {
    var components = this.populate('component');
    for(var key in components) {
        Component.register(key, require(components[key]), this);
    }
};

Container.prototype.populateServices = function() {
    var services = this.populate('service');
    for(var key in services) {
        try {
            var service = Context.create(key, require(services[key]), this);
            this.put('services::' + key, service);
        } catch(e) {
            logger().error('Failed to create context "%s" caused by: %s', key, e.message, e);
        }
    }
};

Container.prototype.getService = function(name) {
    return registry.get('services::' + name);
};

Container.prototype.start = function() {
    logger().info('Starting container');
    this.info(true);

    // initialize yesbee server
    this.server = new Server(this);

    this.populateComponents();
    this.populateServices();

    // autostart
    this.prop('autostart').forEach(function(s) {
        try {
            var service = this.getService(s);
            if (service) {
                service.start();
            } else {
                logger().error('Cannot autostart unknown service "%s"', s, new Error(':('));
            }
        } catch(e) {
            logger().error('Cannot autostart service "%s"', s, e);
        }
    }.bind(this));

    // run server
    this.server.listen().then(function(s) {
        logger().info('Server bound to %s:%s', s.address().address, s.address().port);
    });
};

Container.prototype.stop = function() {
    this.server.close();
};

Container.prototype.info = function(keepContinue) {
    var props = util.flatten(this.props),
        result = [],
        i;

    for(i in props) {
        result.push({
            Key: i,
            Type: (typeof props[i]),
            Value: props[i],
        });
    }
    logger().info('Container properties:\n' + Table.printArray(result));

    if (this.prop('test')) {
        result = [];
        Object.keys(this.scopes).forEach(function(scope) {
            result.push({
                Scope: scope
            });
        });

        logger().info('Scopes:\n' + Table.printArray(result));
    }

    if (!keepContinue) {
        process.exit(33);
    }
};

Container.prototype.require = function(name) {
    return require('./' + name);
};

module.exports = Container;