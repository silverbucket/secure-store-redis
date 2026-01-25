import { expect, test, describe, afterAll, beforeAll } from "./test-compat.ts";
import { Redis } from "ioredis";

import SecureStore, { SecretValidator } from "./index.ts";

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
                uid: "error-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
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

        test("weak secret rejected by default", () => {
            expect(() => {
                new SecureStore({
                    uid: "test",
                    secret: "tooshort",
                    redis: { url: "redis://127.0.0.1:6379" },
                });
            }).toThrow("Invalid secret");
        });

        test("weak secret allowed with allowWeakSecrets", () => {
            const ss = new SecureStore({
                uid: "test",
                secret: "weakbutallowed",
                redis: { url: "redis://127.0.0.1:6379" },
                allowWeakSecrets: true,
            });
            expect(ss).toBeDefined();
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
                uid: "invocations-test",
                secret: "dh348djGk548fKs83kDs8Kj!@ssgJfg1",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store.connect();
        });

        afterAll(async () => {
            await store.disconnect();
        });

        test("basic save and get", async () => {
            await store.save("foo", "hello");
            expect(await store.get("foo")).toEqual("hello");
        });

        test("no clashing", async () => {
            const store1 = new SecureStore({
                uid: "no-clash-test-1",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            const store2 = new SecureStore({
                uid: "no-clash-test-2",
                secret: "923HD8DG26JA0LK1239Hgb651TWfs0j2",
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

    describe("Namespace", () => {
        let store: SecureStore;

        beforeAll(async () => {
            store = new SecureStore({
                uid: "namespace-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store.connect();
        });

        afterAll(async () => {
            await store.disconnect();
        });

        test("save and get with namespace", async () => {
            const users = store.namespace("users");
            await users.save("profile", { name: "John", age: 30 });
            const profile = await users.get("profile");
            expect(profile).toEqual({ name: "John", age: 30 });
        });

        test("namespaces are isolated from each other", async () => {
            const users = store.namespace("users");
            const settings = store.namespace("settings");

            await users.save("key1", "user-value");
            await settings.save("key1", "settings-value");

            expect(await users.get("key1")).toEqual("user-value");
            expect(await settings.get("key1")).toEqual("settings-value");
        });

        test("namespace is isolated from root store", async () => {
            const ns = store.namespace("isolated");
            await store.save("rootkey", "root-value");
            await ns.save("rootkey", "namespace-value");

            expect(await store.get("rootkey")).toEqual("root-value");
            expect(await ns.get("rootkey")).toEqual("namespace-value");
        });

        test("delete within namespace", async () => {
            const ns = store.namespace("delete-test");
            await ns.save("to-delete", "value");
            expect(await ns.get("to-delete")).toEqual("value");

            const deleted = await ns.delete("to-delete");
            expect(deleted).toEqual(1);
            expect(await ns.get("to-delete")).toEqual(null);
        });

        test("typed namespace with schema", async () => {
            interface UserSchema {
                profile: { name: string; email: string };
                preferences: { theme: string; notifications: boolean };
            }

            const users = store.namespace<UserSchema>("typed-users");
            await users.save("profile", { name: "Jane", email: "jane@example.com" });
            await users.save("preferences", { theme: "dark", notifications: true });

            const profile = await users.get("profile");
            const prefs = await users.get("preferences");

            expect(profile).toEqual({ name: "Jane", email: "jane@example.com" });
            expect(prefs).toEqual({ theme: "dark", notifications: true });
        });

        test("get non-existent key in namespace returns null", async () => {
            const ns = store.namespace("empty-ns");
            expect(await ns.get("nonexistent")).toEqual(null);
        });

        test("empty namespace name throws error", () => {
            expect(() => store.namespace("")).toThrow("Namespace name must be a non-empty string");
        });
    });

    describe("Falsy values", () => {
        let store: SecureStore;

        beforeAll(async () => {
            store = new SecureStore({
                uid: "falsy-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: {
                    url: "redis://127.0.0.1:6379",
                },
            });
            await store.connect();
        });

        afterAll(async () => {
            await store.disconnect();
        });

        test("can store and retrieve 0", async () => {
            await store.save("zero", 0);
            expect(await store.get("zero")).toEqual(0);
        });

        test("can store and retrieve false", async () => {
            await store.save("false", false);
            expect(await store.get("false")).toEqual(false);
        });

        test("can store and retrieve empty string", async () => {
            await store.save("empty", "");
            expect(await store.get("empty")).toEqual("");
        });

        test("null data throws error", async () => {
            await expect(store.save("null", null)).rejects.toThrow("No data provided");
        });

        test("undefined data throws error", async () => {
            await expect(store.save("undefined", undefined)).rejects.toThrow("No data provided");
        });
    });

    describe("SecretValidator", () => {

        test("generate creates 32-character string", () => {
            const secret = SecretValidator.generate();
            expect(secret.length).toEqual(32);
        });

        test("validate rejects short secrets", () => {
            const result = SecretValidator.validate("short");
            expect(result.valid).toEqual(false);
            expect(result.reason).toContain("32 characters");
        });

        test("validate rejects weak patterns", () => {
            const result = SecretValidator.validate("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            expect(result.valid).toEqual(false);
        });

        test("validate accepts strong secrets", () => {
            const secret = SecretValidator.generate();
            const result = SecretValidator.validate(secret);
            expect(result.valid).toEqual(true);
        });
    });

    describe("External Redis Client", () => {
        test("accepts pre-connected Redis client", async () => {
            const redis = new Redis({ host: "127.0.0.1", port: 6379 });
            await redis.ping(); // Ensure connected

            const store = new SecureStore({
                uid: "external-client-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: { client: redis },
            });

            await store.connect();
            expect(store.isConnected).toEqual(true);
            expect(store.client).toBe(redis);

            await store.save("extKey", "extValue");
            expect(await store.get("extKey")).toEqual("extValue");

            await store.disconnect();
            // External client should still be connected
            expect(redis.status).toEqual("ready");

            await redis.quit();
        });

        test("accepts Redis client with lazyConnect", async () => {
            const redis = new Redis({
                host: "127.0.0.1",
                port: 6379,
                lazyConnect: true,
            });

            const store = new SecureStore({
                uid: "lazy-client-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: { client: redis },
            });

            // Client is in "wait" state, connect() should connect it
            await store.connect();
            expect(store.isConnected).toEqual(true);

            await store.save("lazyKey", "lazyValue");
            expect(await store.get("lazyKey")).toEqual("lazyValue");

            await store.disconnect();
            expect(redis.status).toEqual("ready");

            await redis.quit();
        });

        test("multiple stores share one client", async () => {
            const redis = new Redis({ host: "127.0.0.1", port: 6379 });
            await redis.ping();

            const store1 = new SecureStore({
                uid: "shared-client-1",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: { client: redis },
            });

            const store2 = new SecureStore({
                uid: "shared-client-2",
                secret: "923HD8DG26JA0LK1239Hgb651TWfs0j2",
                redis: { client: redis },
            });

            await store1.connect();
            await store2.connect();

            await store1.save("key", "value1");
            await store2.save("key", "value2");

            expect(await store1.get("key")).toEqual("value1");
            expect(await store2.get("key")).toEqual("value2");

            await store1.disconnect();
            // Redis should still be connected after store1 disconnect
            expect(redis.status).toEqual("ready");
            expect(store2.isConnected).toEqual(true);

            await store2.disconnect();
            expect(redis.status).toEqual("ready");

            await redis.quit();
        });

        test("throws error if external client is closed", async () => {
            const redis = new Redis({ host: "127.0.0.1", port: 6379 });
            await redis.ping();
            await redis.quit();
            // Poll until status changes to "end" (avoid arbitrary delay)
            while (redis.status !== "end") {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            const store = new SecureStore({
                uid: "closed-client-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: { client: redis },
            });

            await expect(store.connect()).rejects.toThrow(
                "External Redis client is closed",
            );
        });

        test("exposes external client via client property", async () => {
            const redis = new Redis({ host: "127.0.0.1", port: 6379 });
            await redis.ping();

            const store = new SecureStore({
                uid: "client-property-test",
                secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
                redis: { client: redis },
            });

            expect(store.client).toBe(redis);

            await redis.quit();
        });
    });
});
