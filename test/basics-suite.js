function getTests() {
  return [
    {
      desc: '# get something that does not exist',
      run: function (env, test) {
        env.mod.get('blahblah', function (err, data) {
          test.assertTypeAnd(data, 'undefined');
          test.assert(err, 'record not found for key: blahblah');
        });
      }
    },

    {
      desc: '# save string',
      run: function (env, test) {
        env.mod.save('foo', 'hallo', function (err) {
          test.assert(err, null);
        });
      }
    },

    {
      desc: '# get string',
      run: function (env, test) {
        env.mod.get('foo', function (err, data) {
          test.assertAnd(err, null);
          test.assertTypeAnd(data, 'string');
          test.assert(data, 'hallo');
        });
      }
    },

    {
      desc: '# save object',
      run: function (env, test) {
        env.mod.save('foo', { bar: 'baz', wang: 'bang' }, function (err) {
          test.assert(err, null);
        });
      }
    },

    {
      desc: '# get object',
      run: function (env, test) {
        env.mod.get('foo', function (err, data) {
          test.assertAnd(err, null);
          test.assertTypeAnd(data, 'object');
          test.assert(data, { bar: 'baz', wang: 'bang' });
        });
      }
    },

    {
      desc: '# new scope',
      run: function (env, test) {
        env.mod2 = new env.Mod({
          namespace: 'secure-store-redis-tests',
          secret: 'idontknowthekeyidontknowthekey12',
          redis: {
            host: '127.0.0.1',
            port: 6379
          }
        });
        test.assertTypeAnd(env.mod2, 'object');
        test.assertTypeAnd(env.mod2.get, 'function');
        test.assertType(env.mod2.save, 'function');
      }
    },


    {
      desc: '# get (wrong secret)',
      run: function (env, test) {
        env.mod2.get('foo', function (err, data) {
          test.assertAnd(err, 'unable to decrypt');
          test.assertType(data, 'undefined');
        });
      }
    },

    {
      desc: '# save complex object',
      run: function (env, test) {
        env.complexObj = {
          foo: 'bar',
          bad: 'obj',
          this: true,
          me: {
            o: {
              me: {
                o: [true, false, true, null, 'this', 'that', true, 9]
              }
            }
          }
        };
        env.mod2.save('complex', env.complexObj, function (err) {
          test.assert(err, null);
        });
      }
    },

    {
      desc: '# get complex object',
      run: function (env, test) {
        env.mod2.get('complex', function (err, data) {
          test.assertAnd(err, null);
          test.assertTypeAnd(data, 'object');
          test.assert(data, env.complexObj);
        });
      }
    },

  ];
}

if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require'], function (require) {
  return [{
    desc: 'basic tests',
    abortOnFail: true,
    setup: function (env, test) {
      env.Mod = require('./../index');
      test.assertTypeAnd(env.Mod, 'function');
      env.mod = new env.Mod({
        namespace: 'secure-store-redis-tests',
        secret: '823HD8DG26JA0LK1239Hgb651TWfs0j1',
        redis: {
          host: '127.0.0.1',
          port: 6379
        }
      });
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.get, 'function');
      test.assertType(env.mod.save, 'function');
    },
    tests: getTests(),
  },
  {
    desc: 'basic tests again (redis url)',
    abortOnFail: true,
    setup: function (env, test) {
      env.Mod = require('./../index');
      test.assertTypeAnd(env.Mod, 'function');
      env.mod = new env.Mod({
        namespace: 'secure-store-redis-tests',
        secret: '823HD8DG26JA0LK1239Hgb651TWfs0j1',
        redis: {
          url: '127.0.0.1:6379'
        }
      });
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.get, 'function');
      test.assertType(env.mod.save, 'function');
    },
    tests: getTests(),
  }];
});

