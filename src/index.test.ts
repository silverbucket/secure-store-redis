import { expect, test, describe, afterAll, beforeAll } from "./test-compat.ts";

import SecureStore from "./index.ts";

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
                expect(res).toEqual(null);
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
                expect(typeof res).toEqual("string");
                expect(res).toEqual("hallo");
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
                expect(typeof res).toEqual("object");
                expect(res).toEqual({ bar: "baz", wang: "bang" });
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
                expect(typeof res).toEqual("object");
                expect(res).toEqual(complexObj);
            };
        },
    },
];

describe("SecureStore", () => {
    describe("Error handling", () => {
        test("invalid connection config", async () => {
            const ss = new SecureStore({
                redis: {
                    url: "redis://127.0.0.1:6378",
                },
            });
            try {
                await ss.connect();
                throw new Error("should not arrive here");
            } catch (e) {
                // Check for our ConnectionError or underlying Redis error
                const error = e as Error;
                expect(
                    error.message.includes("Failed to connect to Redis") ||
                        error.message.includes("ECONNREFUSED") ||
                        error.message.includes("Connection is closed"),
                ).toEqual(true);
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

        beforeAll(async () => {
            await ss.connect();
        });

        describe("First client", () => {
            for (const testCase of tests) {
                test(testCase.desc, testCase.test(ss));
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

            beforeAll(async () => {
                await ss2.connect();
            });

            test("get (wrong store)", async () => {
                const res = await ss2.get("foo");
                expect(res).toEqual(null);
            });

            afterAll(async () => {
                await ss2.disconnect();
            });
        });

        afterAll(async () => {
            await ss.disconnect();
        });
    });

    describe("Invocations", () => {
        let store: SecureStore;

        beforeAll(async () => {
            store = new SecureStore({
                secret: "dh348djGk548fKs83kDs8kdSfGssgJfg",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
                allowWeakSecrets: true,
            });
            await store.connect();
        });

        afterAll(async () => {
            await store.disconnect();
        });

        test("without uid", async () => {
            await store.save("foo", "hello");
            expect(await store.get("foo")).toEqual("hello");
        });

        test("no clashing", async () => {
            const store1 = new SecureStore({
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            const store2 = new SecureStore({
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store1.connect();
            await store2.connect();
            await store1.save("foo", "hello1");
            expect(await store1.get("foo")).toEqual("hello1");
            await store2.save("foo", "hello2");
            expect(await store2.get("foo")).toEqual("hello2");
            await store1.disconnect();
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

        beforeAll(async () => {
            await ss.connect();
        });

        afterAll(async () => {
            await ss.disconnect();
        });

        describe("First client", () => {
            for (const testCase of tests) {
                test(testCase.desc, testCase.test(ss));
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

            beforeAll(async () => {
                await ss2.connect();
            });

            test("get (wrong store)", async () => {
                const res = await ss2.get("foo");
                expect(res).toEqual(null);
            });

            afterAll(async () => {
                await ss2.disconnect();
            });
        });
    });

    describe("README Example", () => {
        let store: SecureStore;

        beforeAll(async () => {
            store = new SecureStore({
                uid: "myApp:store",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: {
                    url: "redis://localhost:6379",
                },
            });
            await store.connect();
        });

        afterAll(async () => {
            await store.disconnect();
        });

        describe("First client", () => {
            test("save", async () => {
                await store.save("quote", "hello world");
            });

            test("get", async () => {
                expect(await store.get("quote")).toEqual("hello world");
            });

            test("delete", async () => {
                expect(await store.delete("quote")).toEqual(1);
            });

            test("get deleted item fails", async () => {
                expect(await store.get("quote")).toEqual(null);
            });

            test("save", async () => {
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
                allowWeakSecrets: true,
            });

            beforeAll(async () => {
                await ss2.connect();
            });

            test("get (wrong store)", async () => {
                const res = await ss2.get("quote");
                expect(res).toEqual(null);
            });

            afterAll(async () => {
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

            beforeAll(async () => {
                await ss3.connect();
            });

            test("get data from another store", async () => {
                expect(await ss3.get("quote")).toEqual("hello world again");
            });

            afterAll(async () => {
                await ss3.disconnect();
            });
        });
    });
});
