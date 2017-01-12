var RCP     = require('redis-connection-pool'),
    assert  = require('assert'),
    crypto  = require('crypto'),
    dsCrypt = require('dead-simple-crypt');

function shasum(text) {
  var s = crypto.createHash('sha256');
  s.update(text);
  return s.digest('hex');
}

function SecureStore(cfg) {
  assert(typeof cfg.secret === 'string', 'secret must be specified');
  this.namespace = cfg.namespace || 'secure-store-redis';
  this.secret = cfg.secret;

  if (! cfg.redis) { cfg.redis = {}; }
  //this.db   = cfg.db || 0;

  this.pool = RCP(this.namespace, {
    host: cfg.redis.host || 'localhost',
    port: cfg.redis.port || 6379
  });
}

SecureStore.prototype.save = function (postfix, key, data, cb) {
  if (typeof cb !== 'function') {
    assert(typeof data === 'function', 'must specify a callback');
    cb = data;
    data = key;
    key = postfix;
    postfix = '';
  } else {
    postfix = ':' + postfix;
  }
  assert(typeof key === 'string', 'no hash key specified');
  assert(typeof data !== 'undefined', 'no data to save provided');

  if (typeof data === 'object') {
    try {
      data = JSON.stringify(data);
    } catch (e) {
      throw new Error(e);
    }
  }

  data = dsCrypt.encrypt(data, this.secret);

  this.pool.hset(this.namespace + postfix, shasum(key), data, function (err, reply) {
    cb(err, reply);
  });
};

SecureStore.prototype.get = function (postfix, key, cb) {
  if (typeof cb !== 'function') {
    assert(typeof key === 'function', 'must specify a callback');
    cb = key;
    key = postfix;
    postfix = '';
  } else {
    postfix = ':' + postfix;
  }
  assert(typeof key === 'string', 'no hash key specified');

  var self = this;

  this.pool.hget(this.namespace + postfix, shasum(key), function (err, reply) {
    if (err) {
      cb(err);
    } else if (typeof reply !== 'string') {
       cb('record not found for key: ' + key);
    } else {

      var data;

      try {
        data = dsCrypt.decrypt(reply, self.secret);
      } catch (e) {
        return cb('unable to decrypt');
      }

      try {
        data = JSON.parse(data);
      } catch (e) {}

      cb(null, data);
    }
  });
};

module.exports = SecureStore;
