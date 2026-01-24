/**
 * Test compatibility shim for Bun and Node.js
 * Exports a unified API that works with both bun:test and node:test
 */

type TestFn = () => void | Promise<void>;
type DescribeFn = (name: string, fn: () => void) => void;
type TestDefineFn = (name: string, fn: TestFn) => void;
type HookFn = (fn: () => void | Promise<void>) => void;

interface Expect {
    toEqual(expected: unknown): void;
}

type ExpectFn = (actual: unknown) => Expect;

type TestCompat = {
    describe: DescribeFn;
    test: TestDefineFn;
    afterAll: HookFn;
    expect: ExpectFn;
};

const isBun = typeof Bun !== "undefined";

const { describe, test, afterAll, expect } =
    await (async (): Promise<TestCompat> => {
        if (isBun) {
            // Use bun:test
            const bunTest = await import("bun:test");
            return {
                describe: bunTest.describe,
                test: bunTest.test,
                afterAll: bunTest.afterAll,
                expect: bunTest.expect,
            };
        } else {
            // Use node:test and node:assert
            const nodeTest = await import("node:test");
            const assert = await import("node:assert");

            // Create expect wrapper around node:assert
            const expectFn: ExpectFn = (actual: unknown): Expect => ({
                toEqual(expected: unknown) {
                    assert.deepStrictEqual(actual, expected);
                },
            });

            return {
                describe: nodeTest.describe,
                test: nodeTest.it,
                afterAll: nodeTest.after,
                expect: expectFn,
            };
        }
    })();

export { describe, test, afterAll, expect };
