# secure-store-redis

A simple wrapper to encrypt and decrypt data stored in redis.
The main point is to ensure that any data you store in redis cannot be accessed
by anyone else, without the key.

## Installation

```bash
npm install secure-store-redis
```

### Constructor

```typescript
import SecureStore from "secure-store-redis";

const store = new SecureStore({
    uid: "myApp:store", // Optional: auto-generated if not provided
    secret: "32-char-secret", // Optional: auto-generated if not provided
    redis: {
        // Required: Redis connection config
        url: "redis://localhost:6379",
    },
});
```

### Methods

#### `init(): Promise<void>`

Initializes the Redis connection. Must be called before other operations.

```typescript
await store.init();
```

#### `save(key: string, data: unknown, postfix?: string): Promise<void>`

Encrypts and saves data to Redis.

```typescript
await store.save("quote", "hello world");
await store.save("user:123", { name: "John", age: 30 }, "cache");
```

#### `get(key: string, postfix?: string): Promise<unknown>`

Retrieves and decrypts data from Redis. Returns `null` if key doesn't exist.

```typescript
const data = await store.get("quote");
const cached = await store.get("user:123", "cache");
```

#### `delete(key: string, postfix?: string): Promise<number>`

Deletes encrypted data from Redis. Returns number of deleted keys.

```typescript
const deleted = await store.delete("quote");
```

#### `disconnect(client?: Redis): Promise<void>`

Closes the Redis connection.

```typescript
await store.disconnect();
```

## Configuration Options

| Option             | Type                            | Required | Default                        | Description                            |
| ------------------ | ------------------------------- | -------- | ------------------------------ | -------------------------------------- |
| `uid`              | string                          | Yes      | -                              | Prefix for Redis keys                  |
| `secret`           | string                          | Yes      | Use SecretValidator.generate() | 32-character encryption secret         |
| `redis`            | RedisOptions \| { url: string } | Yes      | -                              | Redis connection configuration         |
| `allowWeakSecrets` | boolean                         | No       | false                          | Allow weak secrets (bypass validation) |

### Redis Connection Options

```typescript
// URL format
redis: { url: "redis://localhost:6379" }

// ioredis options
redis: {
    host: "localhost",
    port: 6379,
    password: "optional-password",
    db: 0
}
```

## Security Best Practices

### Secret Management

- Use a cryptographically secure 32-character secret
- Store secrets in environment variables, not code
- Rotate secrets periodically in production
- Use different secrets for different environments
- Use built-in `SecretValidator.generate()` for secure secrets

```typescript
// Good: Environment variable
const secret = process.env.SECURE_STORE_SECRET;

// Good: Auto-generated strong secret
import SecureStore, { SecretValidator } from "secure-store-redis";
const secret = SecretValidator.generate();

// Bad: Hardcoded secret
const secret = "hardcoded-secret-1234567890123456";
```

### Secret Validation

By default, secure-store-redis validates secret strength:

- Minimum 4.0 Shannon entropy
- Mixed character sets (uppercase, lowercase, numbers, special)
- No common weak patterns (repeated chars, sequences, etc.)

```typescript
// This will throw ValidationError for weak secret
const store = new SecureStore({
    secret: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // Too weak
    redis: { url: "redis://localhost:6379" },
});
```

## Migration Guide (v3.x → v4.0)

### Breaking Changes Summary

| Change                  | Impact                            | Migration Required                                               |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Explicit Connection** | Must call `await store.connect()` | Add `await store.connect()` before any operations                |
| **Required UID**        | `uid` parameter now required      | Provide explicit `uid` in constructor                            |
| **Namespace API**       | `postfix` parameter replaced      | Use `store.namespace("name")` method                             |
| **AES-256-GCM**         | Encrypted data incompatible       | Re-encrypt all existing data                                     |
| **Generic Types**       | Method signatures updated         | Add type parameters `<T>`                                        |
| **Error Classes**       | New error types                   | Update catch blocks for new error classes                        |
| **Secret Validation**   | Stronger validation               | Use `SecretValidator.generate()` or set `allowWeakSecrets: true` |

### Step-by-Step Migration

#### 1. Update Imports and Connections

```typescript
// Before v4.0
import SecureStore from "secure-store-redis";
const store = new SecureStore({
    /* config */
});
await store.init();

// After v4.0
import SecureStore from "secure-store-redis";
const store = new SecureStore({
    uid: "my-app", // Now required
    secret: SecretValidator.generate(), // Recommended
    redis: { url: "redis://localhost:6379" },
});
await store.connect(); // Now explicit
```

#### 2. Update Method Calls

```typescript
// Before v4.0
await store.save("key", data, "namespace");

// After v4.0
const ns = store.namespace("namespace");
await ns.save("key", data);
```

#### 3. Update Type Usage

```typescript
// Before v4.0
const data = (await store.get("key")) as any;

// After v4.0
const data = await store.get<UserType>("key");
```

#### 4. Update Error Handling

```typescript
// Before v4.0
try {
    await store.connect();
} catch (err) {
    console.error(err.message);
}

// After v4.0
try {
    await store.connect();
} catch (err) {
    if (err instanceof ConnectionError) {
        console.error("Connection failed:", err.message);
    }
}
```

#### 5. Data Migration (Optional)

For AES-256-GCM encryption changes, you'll need to re-encrypt existing data:

```typescript
// Migration script example
import SecureStore from "secure-store-redis";

const oldStore = new SecureStore({
    uid: "old-app",
    secret: "old-32-char-secret",
    redis: { url: "redis://localhost:6379" },
});
await oldStore.connect();

const newStore = new SecureStore({
    uid: "new-app",
    secret: "new-32-char-secret",
    redis: { url: "redis://localhost:6379" },
});
await newStore.connect();

// Migrate data
const keys = await oldStore.client.keys("old-app:*");
for (const key of keys) {
    const data = await oldStore.get(key);
    if (data) {
        await newStore.save(key.replace("old-app:", "new-app:"), data);
    }
}
```

## API Reference

### Encryption

- Uses AES-256-CBC encryption with random IVs
- Each encrypted value has a unique initialization vector
- Data is stored as `iv:encrypted_data` in Redis

### Deployment Considerations

- Enable Redis authentication in production
- Use TLS for Redis connections
- Monitor Redis memory usage
- Implement proper backup strategies

## Migration Guide (v3.x → v4.0)

### Breaking Changes

1. **Redis Client Type**: `client` property is now `Redis` (ioredis)
2. **Node.js Version**: Minimum Node.js 20 required
3. **TypeScript**: Strict null checks enabled

### Code Changes

#### Before (v3.x)

```typescript
// node-redis client type
const client: RedisClientType = store.client;
```

#### After (v4.0)

```typescript
// ioredis client type
const client: Redis = store.client;
```

### Data Compatibility

- Existing encrypted data remains compatible
- No data migration required
- Configuration format unchanged

## Troubleshooting

### Connection Issues

```typescript
// Error: connect ECONNREFUSED 127.0.0.1:6379
// Solution: Ensure Redis is running and accessible
```

### Decryption Failures

```typescript
// Returns null instead of data
// Common causes:
// - Wrong secret used
// - Data corrupted in Redis
// - Different UID used
```

### Performance Tips

- Use connection pooling for high-throughput applications
- Batch operations when possible
- Monitor Redis memory usage
- Consider Redis persistence settings

## Installation

```bash
npm install secure-store-redis
```

## Basic Usage

```typescript
import SecureStore from "secure-store-redis";

const store = new SecureStore({
    uid: "myApp:store", // Required: explicit namespace
    secret: "32-char-secret-or-use-SecretValidator.generate()", // Required: 32-char secret
    redis: {
        url: "redis://localhost:6379",
    },
});
await store.connect(); // Explicit connection required
```

## Advanced Usage

### Namespaced Storage

```typescript
// Store data with postfix for namespacing
await store.save("user:123", userData, "cache");
await store.save("user:123", sessionData, "session");

// Retrieve from specific namespace
const cached = await store.get("user:123", "cache");
const session = await store.get("user:123", "session");
```

### Error Handling

```typescript
try {
    await store.init();
    await store.save("key", "data");
} catch (error) {
    console.error("SecureStore error:", error);
    // Handle connection or encryption errors
}
```

### TypeScript Support

```typescript
interface User {
    name: string;
    age: number;
}

// Type-safe usage
const user = (await store.get<User>("user:123")) as User;
await store.save<User>("user:123", { name: "John", age: 30 });
```
