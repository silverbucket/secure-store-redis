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
    toBe(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeDefined(): void;
    toThrow(expected?: string | RegExp): void;
    rejects: {
        toThrow(expected?: string | RegExp): Promise<void>;
    };
}

type ExpectFn = (actual: unknown) => Expect;

type TestCompat = {
    describe: DescribeFn;
    test: TestDefineFn;
    beforeAll: HookFn;
    afterAll: HookFn;
    expect: ExpectFn;
};

const isBun = typeof Bun !== "undefined";

const { describe, test, beforeAll, afterAll, expect } =
    await (async (): Promise<TestCompat> => {
        if (isBun) {
            // Use bun:test
            const bunTest = await import("bun:test");
            return {
                describe: bunTest.describe,
                test: bunTest.test,
                beforeAll: bunTest.beforeAll,
                afterAll: bunTest.afterAll,
                expect: bunTest.expect,
            };
        }
        // Use node:test and node:assert
        const nodeTest = await import("node:test");
        const assert = await import("node:assert");

        // Create expect wrapper around node:assert
        const expectFn: ExpectFn = (actual: unknown): Expect => ({
            toEqual(expected: unknown) {
                assert.deepStrictEqual(actual, expected);
            },
            toBe(expected: unknown) {
                assert.strictEqual(actual, expected);
            },
            toContain(expected: unknown) {
                assert.ok(
                    String(actual).includes(String(expected)),
                    `Expected "${actual}" to contain "${expected}"`,
                );
            },
            toBeDefined() {
                assert.ok(actual !== undefined, "Expected value to be defined");
            },
            toThrow(expected?: string | RegExp) {
                let threw = false;
                let error: Error | undefined;
                try {
                    (actual as () => void)();
                } catch (e) {
                    threw = true;
                    error = e as Error;
                }
                assert.ok(threw, "Expected function to throw");
                if (expected && error) {
                    const matches =
                        typeof expected === "string"
                            ? error.message.includes(expected)
                            : expected.test(error.message);
                    assert.ok(
                        matches,
                        `Expected error message "${error.message}" to match "${expected}"`,
                    );
                }
            },
            rejects: {
                async toThrow(expected?: string | RegExp) {
                    let threw = false;
                    let error: Error | undefined;
                    try {
                        await (actual as Promise<unknown>);
                    } catch (e) {
                        threw = true;
                        error = e as Error;
                    }
                    assert.ok(threw, "Expected promise to reject");
                    if (expected && error) {
                        const matches =
                            typeof expected === "string"
                                ? error.message.includes(expected)
                                : expected.test(error.message);
                        assert.ok(
                            matches,
                            `Expected error message "${error.message}" to match "${expected}"`,
                        );
                    }
                },
            },
        });

        return {
            describe: nodeTest.describe,
            test: nodeTest.it,
            beforeAll: nodeTest.before,
            afterAll: nodeTest.after,
            expect: expectFn,
        };
    })();

export { afterAll, beforeAll, describe, expect, test };
