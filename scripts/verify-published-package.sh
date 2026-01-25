#!/bin/bash

set -e

VERSION="${1:-latest}"
TEST_DIR=$(mktemp -d)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

echo "=============================================="
echo "secure-store-redis Verification Script"
echo "=============================================="
echo "Version: $VERSION"
echo "Test directory: $TEST_DIR"
echo ""

# Check prerequisites
check_prereqs() {
  local missing=()

  command -v node >/dev/null 2>&1 || missing+=("node")
  command -v npm >/dev/null 2>&1 || missing+=("npm")
  command -v bun >/dev/null 2>&1 || missing+=("bun")

  if ! redis-cli ping >/dev/null 2>&1; then
    missing+=("redis (not running)")
  fi

  if [ ${#missing[@]} -ne 0 ]; then
    echo "ERROR: Missing prerequisites: ${missing[*]}"
    exit 1
  fi

  echo "Prerequisites:"
  echo "  Node.js: $(node --version)"
  echo "  Bun:     $(bun --version)"
  echo "  Redis:   $(redis-cli ping)"
  echo ""
}

# Create the test script content
TEST_SCRIPT='
import SecureStore, { SecretValidator } from "secure-store-redis";

const RUNTIME = typeof Bun !== "undefined" ? "Bun" : "Node.js";

async function runTests() {
  const results = { passed: 0, failed: 0, errors: [] };

  function test(name, condition) {
    if (condition) {
      results.passed++;
      console.log(`  ✓ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`  ✗ ${name}`);
    }
  }

  console.log(`\n[${RUNTIME}] Running tests...\n`);

  let store;
  try {
    // Test: Generate secret
    const secret = SecretValidator.generate();
    test("SecretValidator.generate() creates 32-char secret", secret.length === 32);

    // Test: Initialize store
    store = new SecureStore({
      uid: `verify-${RUNTIME.toLowerCase()}-${Date.now()}`,
      secret: secret,
      redis: { url: "redis://localhost:6379" }
    });
    test("SecureStore initializes without error", store !== null);

    // Test: Connect
    await store.connect();
    test("connect() establishes Redis connection", true);

    // Test: Save and retrieve data
    const testData = { foo: "bar", number: 42, nested: { value: true } };
    await store.save("testKey", testData);
    const retrieved = await store.get("testKey");
    test("save() and get() work correctly", JSON.stringify(retrieved) === JSON.stringify(testData));

    // Test: Data with postfix
    await store.save("key", { data: "with-postfix" }, "postfix");
    const postfixData = await store.get("key", "postfix");
    test("save/get with postfix works", postfixData?.data === "with-postfix");

    // Test: Namespace
    const ns = store.namespace("testNamespace");
    await ns.save("nsKey", { namespaced: true });
    const nsData = await ns.get("nsKey");
    test("namespace() creates working partition", nsData?.namespaced === true);

    // Test: Non-existent key returns null
    const nonExistent = await store.get("does-not-exist-" + Date.now());
    test("get() returns null for non-existent key", nonExistent === null);

    // Test: Delete
    await store.delete("testKey");
    const deleted = await store.get("testKey");
    test("delete() removes data", deleted === null);

    // Cleanup
    await store.delete("key", "postfix");
    await ns.delete("nsKey");

  } catch (err) {
    results.failed++;
    results.errors.push(`Unexpected error: ${err.message}`);
    console.error(`  ✗ Unexpected error: ${err.message}`);
  } finally {
    if (store) {
      try {
        await store.disconnect();
        test("disconnect() closes connection", true);
      } catch (e) {
        console.error(`  ✗ disconnect() failed: ${e.message}`);
      }
    }
  }

  console.log(`\n[${RUNTIME}] Results: ${results.passed} passed, ${results.failed} failed`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`[${RUNTIME}] Fatal error:`, err.message);
  process.exit(1);
});
'

# Run Node.js tests
run_node_tests() {
  echo "----------------------------------------------"
  echo "Testing with Node.js..."
  echo "----------------------------------------------"

  local node_dir="$TEST_DIR/node-test"
  mkdir -p "$node_dir"
  cd "$node_dir"

  npm init -y >/dev/null 2>&1

  local pkg="secure-store-redis"
  [ "$VERSION" != "latest" ] && pkg="secure-store-redis@$VERSION"

  echo "Installing $pkg..."
  if ! npm install "$pkg" 2>&1 | grep -E "(added|up to date|npm error)"; then
    echo "ERROR: Failed to install package"
    return 1
  fi

  echo "$TEST_SCRIPT" > test.mjs
  node test.mjs
}

# Run Bun tests
run_bun_tests() {
  echo ""
  echo "----------------------------------------------"
  echo "Testing with Bun..."
  echo "----------------------------------------------"

  local bun_dir="$TEST_DIR/bun-test"
  mkdir -p "$bun_dir"
  cd "$bun_dir"

  bun init -y >/dev/null 2>&1

  local pkg="secure-store-redis"
  [ "$VERSION" != "latest" ] && pkg="secure-store-redis@$VERSION"

  echo "Installing $pkg..."
  if ! bun add "$pkg" 2>&1 | grep -E "(installed|error)"; then
    echo "ERROR: Failed to install package"
    return 1
  fi

  echo "$TEST_SCRIPT" > test.ts
  bun run test.ts
}

# Main
check_prereqs

NODE_RESULT=0
BUN_RESULT=0

run_node_tests || NODE_RESULT=1
run_bun_tests || BUN_RESULT=1

echo ""
echo "=============================================="
echo "VERIFICATION SUMMARY"
echo "=============================================="
echo "Package: secure-store-redis@$VERSION"
echo ""

if [ $NODE_RESULT -eq 0 ]; then
  echo "Node.js: PASSED ✓"
else
  echo "Node.js: FAILED ✗"
fi

if [ $BUN_RESULT -eq 0 ]; then
  echo "Bun:     PASSED ✓"
else
  echo "Bun:     FAILED ✗"
fi

echo ""

if [ $NODE_RESULT -eq 0 ] && [ $BUN_RESULT -eq 0 ]; then
  echo "All verifications passed!"
  exit 0
else
  echo "Some verifications failed!"
  exit 1
fi
