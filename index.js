const RCP     = require('redis-connection-pool'),
      assert  = require('assert'),
      crypto  = require('crypto'),
      ALGORITHM = 'aes-256-cbc',
      IV_LENGTH = 16; // For AES, this is always 16


const helpers = {
  encrypt: function (data, secret) {
    if (secret.length > 32) {
      throw new Error(`secret length must be 32 characters, it's ${secret.length}`);
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, new Buffer.from(secret), iv);
    let encrypted = cipher.update(data);

    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  },
  decrypt: function (string, secret) {
    if (secret.length > 32) {
      throw new Error(`secret length must be 32 characters, it's ${secret.length}`);
    }
    let parts = string.split(':');
    const iv = new Buffer.from(parts.shift(), 'hex');
    const encryptedText = new Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, new Buffer.from(secret), iv);
    let decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  },
  shasum: function (text) {
    const s = crypto.createHash('sha256');
    s.update(text);
    return s.digest('hex');
  }
};

function SecureStore(cfg) {
  assert(typeof cfg.secret === 'string', 'secret must be specified (32 chars)');
  assert(typeof cfg.secret.length !== 32, `secret must be 32 chars, actually
         ${cfg.secret.length}`);
  this.namespace = cfg.namespace || 'secure-store-redis';
  this.secret = cfg.secret;

  this.errorOnNotFound = cfg.errorOnNotFound || true;

  if (! cfg.redis) { cfg.redis = {}; }
  //this.db   = cfg.db || 0;

  let rcpConfig = {
    max_clients: cfg.redis.max_clients || 30,
    database: cfg.redis.database || 0,
    options: cfg.redis.options || null
  };

  if (cfg.redis.url) {
    rcpConfig.url = cfg.redis.url;
  } else {
    rcpConfig.host = cfg.redis.host || 'localhost';
    rcpConfig.port = cfg.redis.port || 6379;
  }

  this.pool = new RCP(this.namespace, rcpConfig);
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

  data = helpers.encrypt(data, this.secret);

  this.pool.hset(this.namespace + postfix, helpers.shasum(key), data, cb);
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

  this.pool.hget(this.namespace + postfix, helpers.shasum(key), (err, reply) => {
    if (err) {
      cb(err);
    } else if (typeof reply !== 'string') {
      if (this.errorOnNotFound) {
        return cb('record not found for key: ' + key);
      } else {
        return cb(null, null);
      }
    } else {

      let data;

      try {
        data = helpers.decrypt(reply, this.secret);
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

SecureStore.prototype.delete = function (postfix, key, cb) {
  if (typeof cb !== 'function') {
    assert(typeof key === 'function', 'must specify a callback');
    cb = key;
    key = postfix;
    postfix = '';
  } else {
    postfix = ':' + postfix;
  }
  assert(typeof key === 'string', 'no hash key specified');
  this.pool.hdel(this.namespace + postfix, helpers.shasum(key), cb);
};

module.exports = SecureStore;
