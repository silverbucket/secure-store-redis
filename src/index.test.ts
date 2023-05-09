import {expect} from "chai";

import SecureStore from "./index";



describe("SecureStore", () => {
  let ss: SecureStore;

  const tests = [
    {
      desc: 'get something that does not exist',
      run: async () => {
        const res = await ss.get('blahblah');
        expect(res).to.eql(null);
      }
    },

    {
      desc: 'save string',
      run: async () => {
        await ss.save('foo', 'hallo');
      }
    },

    {
      desc: 'get string',
      run: async () => {
        const res = await ss.get('foo');
        expect(typeof res).to.eql('string');
        expect(res).to.eql('hallo');
      }
    },

    {
      desc: 'save object',
      run: async () =>  {
        await ss.save('foo', { bar: 'baz', wang: 'bang' });
      }
    },

    {
      desc: 'get object',
      run: async () =>  {
        const res = await ss.get('foo');
        expect(typeof res).to.eql('object');
        expect(res).to.eql({ bar: 'baz', wang: 'bang' });
      }
    }
  ];

  describe("connect with URL", () => {
    beforeEach(async () => {
        ss = new SecureStore('secure-store-redis-tests', '823HD8DG26JA0LK1239Hgb651TWfs0j1', {
          redis: {
            url: 'redis://127.0.0.1:6379'
          }
        });
    });

    for (const test of tests) {
      it(test.desc, test.run);
    }

    it('quit', async () => {
      await ss.quit();
    });

    it('disconnect', async () => {
      await ss.disconnect();
    });
  });


  // {
  //       desc: 'new scope',
  //       run: async () => {
  //         env.mod2 = new env.Mod('secure-store-redis-tests', 'idontknowthekeyidontknowthekey12', {
  //           host: '127.0.0.1',
  //           port: 6379
  //         });
  //         await env.mod2.init();
  //         test.assertTypeAnd(env.mod2, 'object');
  //         test.assertTypeAnd(env.mod2.get, 'function');
  //         test.assertType(env.mod2.save, 'function');
  //       }
  //     },
  //
  //
  //     {
  //       desc: 'get (wrong secret)',
  //       run: () => {
  //         const res = env.mod2.get('foo');
  //         expect(res).to.eql(null);
  //       }
  //     },
  //
  //     {
  //       desc: 'save complex object',
  //       run: async () => {
  //         env.complexObj = {
  //           foo: 'bar',
  //           bad: 'obj',
  //           this: true,
  //           me: {
  //             o: {
  //               me: {
  //                 o: [true, false, true, null, 'this', 'that', true, 9]
  //               }
  //             }
  //           }
  //         };
  //         await env.mod2.save('complex', env.complexObj);
  //         test.done();
  //       }
  //     },
  //
  //     {
  //       desc: 'get complex object',
  //       run: async () => {
  //         const res = await env.mod2.get('complex');
  //         test.assertTypeAnd(res, 'object');
  //         test.assert(res, env.complexObj);
  //       }
  //     },
});
