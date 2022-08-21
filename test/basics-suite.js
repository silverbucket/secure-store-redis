function getTests() {
  return [
    {
      desc: '# get something that does not exist',
      run: async function (env, test) {
        const res = await env.mod.get('blahblah');
        test.assert(res, null);
      }
    },

    {
      desc: '# save string',
      run: async function (env, test) {
        await env.mod.save('foo', 'hallo');
        test.done();
      }
    },

    {
      desc: '# get string',
      run: async function (env, test) {
        const res = await env.mod.get('foo');
        test.assertTypeAnd(res, 'string');
        test.assert(res, 'hallo');
      }
    },

    {
      desc: '# save object',
      run: async function (env, test) {
        await env.mod.save('foo', { bar: 'baz', wang: 'bang' });
        test.done();
      }
    },

    {
      desc: '# get object',
      run: async function (env, test) {
        const res = await env.mod.get('foo');
        test.assertTypeAnd(res, 'object');
        test.assert(res, { bar: 'baz', wang: 'bang' });
      }
    },

    {
      desc: '# new scope',
      run: async function (env, test) {
        env.mod2 = new env.Mod('secure-store-redis-tests', 'idontknowthekeyidontknowthekey12', {
          host: '127.0.0.1',
          port: 6379
        });
        await env.mod2.init();
        test.assertTypeAnd(env.mod2, 'object');
        test.assertTypeAnd(env.mod2.get, 'function');
        test.assertType(env.mod2.save, 'function');
      }
    },


    {
      desc: '# get (wrong secret)',
      run: function (env, test) {
        const res = env.mod2.get('foo');
        test.assert(res, null);
      }
    },

    {
      desc: '# save complex object',
      run: async function (env, test) {
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
        await env.mod2.save('complex', env.complexObj);
        test.done();
      }
    },

    {
      desc: '# get complex object',
      run: async function (env, test) {
        const res = await env.mod2.get('complex');
        test.assertTypeAnd(res, 'object');
        test.assert(res, env.complexObj);
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
    setup: async function (env, test) {
      env.Mod = require('./../dist/index').default;
      test.assertTypeAnd(env.Mod, 'function');
      env.mod = new env.Mod('secure-store-redis-tests', '823HD8DG26JA0LK1239Hgb651TWfs0j1', {
        host: '127.0.0.1',
        port: 6379
      });
      await env.mod.init();
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.get, 'function');
      test.assertType(env.mod.save, 'function');
    },
    tests: getTests(),
  },
  {
    desc: 'basic tests again (redis url)',
    abortOnFail: true,
    setup: async function (env, test) {
      env.Mod = require('./../dist/index').default;
      test.assertTypeAnd(env.Mod, 'function');
      env.mod = new env.Mod('secure-store-redis-tests', '823HD8DG26JA0LK1239Hgb651TWfs0j1', {
        url: '127.0.0.1:6379'
      });
      await env.mod.init();
      test.assertTypeAnd(env.mod, 'object');
      test.assertTypeAnd(env.mod.get, 'function');
      test.assertType(env.mod.save, 'function');
    },
    tests: getTests(),
  }];
});
