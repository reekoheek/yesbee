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
    Message = require('./message'),
    path = require('path'),
    logger = require('./logger'),
    registry = require('./registry'),
    Broker = require('./broker'),
    Table = require('easy-table'),
    uuid = require('node-uuid'),
    util = require('./util'),
    pantsPath = require('./path'),
    Registry = require('./registry'),
    clusterize = require('./clusterize'),
    cluster = require('cluster'),
    minimist = require('minimist'),
    version = require('../package').version,
    clc = require('cli-color');

/**
 * Container
 * @param {string} containerPath
 */
var Container = function(manifest) {
    "use strict";

    var manifestFile,
        moduleDir = path.resolve('./node_modules');


    this.clazz = '$container';

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

    clusterize.setDefaultHandler(this);

    this.registry = new Registry({
        name: this.prop('name')
    });

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

    this.invocationSessions = {};
};

/**
 * Container#addScope
 * @param {string} rootDir Root directory for the new scope
 *
 * @return {Container} to be chained
 */
Container.prototype.addScope = function(rootDir) {
    "use strict";

    rootDir = rootDir.trim();
    this.scopes[rootDir] = rootDir;
    return this;
};

Container.prototype.getScopes = function() {
    "use strict";

    return Object.keys(this.scopes);

};

/**
 * Getter/setter for prop
 * @param  {var} arg1
 * @param  {var} arg2
 * @return {var}
 */
Container.prototype.prop = function(propName, propValue) {
    "use strict";

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
    "use strict";

    var scripts = [];

    this.getScopes().forEach(function(scope) {
        var scopeDir = path.resolve(scope, type);

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

Container.prototype.startService = function(serviceName) {
    "use strict";

    try {
        this.registry.get('services/' + serviceName).start();
    } catch(e) {
        throw 'Unable to start service: ' + serviceName;
    }
};

Container.prototype.stopService = function(serviceName) {
    "use strict";

    this.registry.get('services/' + serviceName).stop();
};

Container.prototype.getServices = function() {
    "use strict";

    var services = [];
    var found = this.registry.find('services/*');
    for(var i in found) {
        var service = found[i];
        services.push({
            name: service.name,
            status: service.status
        });
    }
    return services;
};

Container.prototype.populateComponents = function() {
    "use strict";

    var components = this.populate('components');
    for(var key in components) {
        Component.register(key, require(components[key]), this);
    }
};

Container.prototype.populateServices = function() {
    "use strict";

    var services = this.populate('services');
    for(var key in services) {
        try {
            var service = Context.create(key, require(services[key]), this);
            this.registry.put('services/' + key, service);
        } catch(e) {
            logger().error('Failed to create context "%s" caused by: %s', key, e.message, e);
        }
    }
};

Container.prototype.start = function() {
    "use strict";

    logger().info('Starting container');
    this.info(true);

    this.populateComponents();
    this.populateServices();

    // autostart
    this.prop('autostart').forEach(function(s) {
        try {
            var service = this.registry.get('services/' + s);
            if (service) {
                service.start();
            } else {
                logger().error('Cannot autostart unknown service "%s"', s, new Error(':('));
            }
        } catch(e) {
            logger().error('Cannot autostart service "%s"', s, e);
        }
    }.bind(this));

    // initialize yesbee server
    this.broker = new Broker(this);
};

Container.prototype.stop = function() {
    "use strict";

    return util.promise(function(resolve, reject) {
        this.broker.close(function() {
            logger().info('Broker stopped!');

            var services = this.registry.find('services/*');
            for(var i in services) {
                if (services[i].status) {
                    services[i].stop();
                }
            }

            resolve();

            setImmediate(function() {
                cluster.worker.disconnect();
            });
        }.bind(this));

    }.bind(this));
};

Container.prototype.send = function() {
    "use strict";

    return clusterize.send.apply(this, arguments);
};

Container.prototype.workerAction = function(method) {
    "use strict";

    return this.send({
        topic: method,
        body: Array.prototype.slice.call(arguments, 1),
        wait: true
    });
};

Container.prototype.on = function() {
    "use strict";

    return clusterize.on.apply(this, arguments);
};

Container.prototype.invokeCommand = function(method, options) {
    "use strict";

    options.stdio = options.stdio || [ null, process.stdout, process.stdin ];

    return util.promise(function(resolve, reject) {
        var handle = {
            write: function() {
                this.out.write.apply(this.out, arguments);
            }
        };

        Object.defineProperties(handle, {
            'container': { value: this },
            'out': { value: options.stdio[1] || process.stdout },
            'in': { value: options.stdio[2] || process.stdin },
            'args': { value: options.args || {} },
            'resolve': { value: resolve },
            'reject': { value: reject }
        });

        return this.require('commands/' + method).apply(handle, options.args || []);
    }.bind(this));
};

Container.prototype.info = function(keepContinue) {
    "use strict";

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
    "use strict";

    return require('./' + name);
};

module.exports = Container;