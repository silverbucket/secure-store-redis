import { expect } from "chai";

import SecureStore from "./index.js";

const complexObj = {
    foo: "bar",
    bad: "obj",
    this: true,
    me: {
        o: {
            me: {
                o: [true, false, true, null, "this", "that", true, 9],
            },
        },
    },
};

const tests = [
    {
        desc: "get something that does not exist",
        test: (store: SecureStore) => {
            return async () => {
                const res = await store.get("blahblah");
                expect(res).to.eql(null);
            };
        },
    },

    {
        desc: "save string",
        test: (store: SecureStore) => {
            return async () => {
                await store.save("foo", "hallo");
            };
        },
    },

    {
        desc: "get string",
        test: (store: SecureStore) => {
            return async () => {
                const res = await store.get("foo");
                expect(typeof res).to.eql("string");
                expect(res).to.eql("hallo");
            };
        },
    },

    {
        desc: "save object",
        test: (store: SecureStore) => {
            return async () => {
                await store.save("foo", { bar: "baz", wang: "bang" });
            };
        },
    },

    {
        desc: "get object",
        test: (store: SecureStore) => {
            return async () => {
                const res = await store.get("foo");
                expect(typeof res).to.eql("object");
                expect(res).to.eql({ bar: "baz", wang: "bang" });
            };
        },
    },

    {
        desc: "save complex object",
        test: (store: SecureStore) => {
            return async () => {
                await store.save("complex", complexObj);
            };
        },
    },

    {
        desc: "get complex object",
        test: (store: SecureStore) => {
            return async () => {
                const res = await store.get("complex");
                expect(typeof res).to.eql("object");
                expect(res).to.eql(complexObj);
            };
        },
    },
];

describe("SecureStore", () => {
    describe("Error handling", () => {
        it("invalid connection config", async () => {
            const ss = new SecureStore({
                redis: {
                    url: "redis://127.0.0.1:6378",
                },
            });
            try {
                await ss.init();
                throw new Error("should not arrive here");
            } catch (e) {
                expect(e.toString()).to.eql(
                    "Error: connect ECONNREFUSED 127.0.0.1:6378",
                );
            }
        });
    });

    describe("Client get and save", () => {
        const ss = new SecureStore({
            uid: "ssr-test",
            secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
            redis: {
                url: "redis://127.0.0.1:6379",
            },
        });

        describe("First client", () => {
            for (const test of tests) {
                it(test.desc, test.test(ss));
            }
        });

        describe("Second client", () => {
            const ss2 = new SecureStore({
                uid: "ssr-test2",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j2",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });

            it("get (wrong store)", async () => {
                const res = await ss2.get("foo");
                expect(res).to.eql(null);
            });

            after(async () => {
                await ss2.disconnect();
            });
        });

        after(async () => {
            await ss.disconnect();
        });
    });

    describe("Invocations", () => {
        it("without uid", async () => {
            const store = new SecureStore({
                secret: "dh348djgk548fks83kds8kdsfgssgjfg",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store.save("foo", "hello");
            expect(await store.get("foo")).to.eql("hello");
            await store.disconnect();
        });
        it("no clashing", async () => {
            const store = new SecureStore({
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store.save("foo", "hello1");
            expect(await store.get("foo")).to.eql("hello1");
            const store2 = new SecureStore({
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store2.save("foo", "hello2");
            expect(await store2.get("foo")).to.eql("hello2");
            await store.disconnect();
            await store2.disconnect();
        });
    });

    describe("Long UID", () => {
        const ss = new SecureStore({
            uid: "secure-store-redis-test1",
            secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
            redis: {
                url: "redis://127.0.0.1:6379",
            },
        });

        describe("First client", () => {
            for (const test of tests) {
                it(test.desc, test.test(ss));
            }
        });

        describe("Second client", () => {
            const ss2 = new SecureStore({
                uid: "secure-store-redis-test2",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j2",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });

            it("get (wrong store)", async () => {
                const res = await ss2.get("foo");
                expect(res).to.eql(null);
            });

            after(async () => {
                await ss2.disconnect();
            });
        });

        after(async () => {
            await ss.disconnect();
        });
    });

    describe("README Example", () => {
        const store = new SecureStore({
            uid: "myApp:store",
            secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
            redis: {
                url: "redis://localhost:6379",
            },
        });

        describe("First client", () => {
            it("save", async () => {
                await store.save("quote", "hello world");
            });
            it("get", async () => {
                expect(await store.get("quote")).to.eql("hello world");
            });
            it("delete", async () => {
                expect(await store.delete("quote")).to.eql(1);
            });
            it("get deleted item fails", async () => {
                expect(await store.get("quote")).to.eql(null);
            });
            it("save", async () => {
                await store.save("quote", "hello world again");
            });
        });

        describe("Second client", () => {
            const ss2 = new SecureStore({
                uid: "myApp:store",
                secret: "this is the wrong secret 32 char",
                redis: {
                    url: "redis://localhost:6379",
                },
            });

            it("get (wrong store)", async () => {
                const res = await ss2.get("quote");
                expect(res).to.eql(null);
            });

            after(async () => {
                await ss2.disconnect();
            });
        });

        describe("Third client (same secret)", () => {
            const ss3 = new SecureStore({
                uid: "myApp:store",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: {
                    url: "redis://localhost:6379",
                },
            });

            it("get data from another store", async () => {
                expect(await ss3.get("quote")).to.eql("hello world again");
            });

            after(async () => {
                await ss3.disconnect();
            });
        });

        after(async () => {
            await store.disconnect();
        });
    });
});
