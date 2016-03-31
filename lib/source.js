//jshint esnext:true
const co = require('co');
const delegate = require('delegates');
const assert = require('assert');

module.exports = (function()  {
  'use strict';

  var sequence = 0;

  function Source (component, uri, options) {
    assert(component, 'Invalid arguments, {Component} component, {string} uri');
    assert('string' === typeof uri, 'Invalid arguments, {Component} component, {string} uri');

    Object.defineProperties(this, {
      id: { enumerable:true, writable:false, configurable:false, value: 'source-'+ sequence++ },
      uri: { enumerable:true, writable:false, configurable:false, value: uri },
      options: { enumerable:false, writable:false, configurable:false, value: options || {} },
      component: { enumerable:false, writable:false, configurable:false, value: component },
      consumer: { enumerable:false, writable:true, configurable:false, value: null },
    });
  }

  Source.prototype = {
    dump() {
      return {
        id: this.id,
        uri: this.uri,
        options: this.options,
      };
    },

    consume(message) {
      assert(message, 'Invalid arguments, {Message} message');
      assert(this.consumer, 'Cannot consume from inactive source on stopped route');

      return co(function *() {
        try {
          return yield this.consumer.call(message);
        } catch(e) {
          if (!this.component.context.isWorker) {
            this.logger({$name: this.component.name, level: 'error', message: e.stack });
          }
          throw e;
        }
      }.bind(this));
    },

    start(consumer) {
      this.consumer = consumer;
      if ('function' === typeof this.component.start) {
        return this.component.start(this);
      }
    },

    stop() {
      if ('function' === typeof this.component.stop) {
        return this.component.stop(this);
      }
    },
  };

  delegate(Source.prototype, 'component')
    .method('logger')
    .access('context');

  return Source;
})();