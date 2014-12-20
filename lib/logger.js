/**
 * yesbee logger
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
var winston = require('winston'),
    path = require('path'),
    clc = require('cli-color'),
    mkdirp = require('mkdirp'),
    util = require('./util');

var props = {
        logDir: path.join(process.cwd(), 'logs')
    },
    LEVELS = {
        trace: 0,
        debug: 1,
        info: 2,
        warn: 3,
        error: 4
    },
    COLORS = {
        trace: 'cyan',
        debug: 'blue',
        info: 'green',
        warn: 'yellow',
        error: 'red'
    };

var transportConsole = function(options) {
    return new (winston.transports.Console)(util.arrayMerge({
        level: 'info',
        colorize: true,
    }, options || {}));
};

winston.addColors(COLORS);

var logger = module.exports = function(cat) {
    "use strict";

    if (cat && cat.clazz === '$context') {
        cat = cat.name;
    }

    cat = cat || '-';

    var id = props.id || 0,
        categoryId = id + '/' + cat,
        categoryLabel = '#' + categoryId,
        log;

    if (!winston.loggers.has(categoryId)) {
        var baseDir = path.join(props.logDir, id + '');

        mkdirp.sync(baseDir);

        if (!id || cat === '-') {
            log = winston.loggers.add(categoryId, {
                transports: [
                    transportConsole({ label: categoryLabel }),
                    new (winston.transports.DailyRotateFile)({
                        name: 'dailyrollinglog',
                        label: '#' + categoryId,
                        level: 'info',
                        datePattern: '.yyyy-MM-dd.log',
                        // prettyPrint: true,
                        json: false,
                        filename: path.join(baseDir, cat)
                    })
                ]
            });
        } else {
            log = winston.loggers.add(categoryId, {
                transports: [
                    new (winston.transports.DailyRotateFile)({
                        name: 'dailyrollinglog',
                        label: '#' + categoryId,
                        level: 'info',
                        datePattern: '.yyyy-MM-dd.log',
                        // prettyPrint: true,
                        json: false,
                        filename: path.join(baseDir, cat)
                    })
                ]
            });
        }

        log.setLevels(LEVELS);

        log.on('logging', function(transport, level) {
            var lastArg = arguments[arguments.length - 1];
            if (props.debug && level === 'error' && lastArg instanceof Error) {
                console.info(clc.red(lastArg.stack));
            }
        });
    } else {
        log = winston.loggers.get(categoryId);
    }

    return log;
};

logger.create = function(cat, level) {
    if (cat && cat.clazz === '$context') {
        cat = cat.name;
    }

    cat = (cat || '')  + '-' + level;

    var id = props.id || 0,
        categoryId = id + '/' + cat,
        categoryLabel = '#' + categoryId,
        logName = level + 'log',
        log;

    if (!winston.loggers.has(categoryId)) {
        var baseDir = path.join(props.logDir, id + '');

        mkdirp.sync(baseDir);

        log = winston.loggers.add(categoryId, {
            transports: [
                new (winston.transports.DailyRotateFile)({
                    name: logName,
                    label: categoryLabel,
                    level: level,
                    datePattern: '.yyyy-MM-dd.' + level,
                    // prettyPrint: true,
                    json: false,
                    filename: path.join(baseDir, cat)
                })
            ]
        });

        var levels = {};
        levels[level] = 0;
        log.setLevels(levels);

        log.transports[logName].once('open', function() {
            log.transports[logName].flush();
        });
    } else {
        log = winston.loggers.get(categoryId);
    }


    return log;
};

mkdirp.sync(props.logDir);

var log = winston.loggers.add('legacy', {
    transports: [
        new (winston.transports.DailyRotateFile)({
            name: 'legacylog',
            label: '<legacy>',
            level: 'info',
            datePattern: '.yyyy-MM-dd.log',
            // prettyPrint: true,
            json: false,
            filename: path.join(process.cwd(), 'logs/legacy')
        })
    ]
});

logger.i = function() {
    var message = 'invoking deprecated logger.i';
    log.error(message);
    throw new Error(message);
};

logger.prop = function(k, v) {
    "use strict";

    if (typeof k === 'object') {
        for(var i in k) {
            logger.prop(i, k[i]);
        }
    } else {
        if (arguments.length === 1) {
            return props[k];
        } else {
            props[k] = v;
        }
    }
};