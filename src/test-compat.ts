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

export let describe: DescribeFn;
export let test: TestDefineFn;
export let afterAll: HookFn;
export let expect: ExpectFn;

const isBun = typeof Bun !== "undefined";

if (isBun) {
    // Use bun:test
    const bunTest = await import("bun:test");
    describe = bunTest.describe;
    test = bunTest.test;
    afterAll = bunTest.afterAll;
    expect = bunTest.expect;
} else {
    // Use node:test and node:assert
    const nodeTest = await import("node:test");
    const assert = await import("node:assert");

    describe = nodeTest.describe;
    test = nodeTest.it;
    afterAll = nodeTest.after;

    // Create expect wrapper around node:assert
    expect = (actual: unknown): Expect => ({
        toEqual(expected: unknown) {
            assert.deepStrictEqual(actual, expected);
        },
    });
}
