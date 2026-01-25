# secure-store-redis

[![npm version](https://img.shields.io/npm/v/secure-store-redis.svg)](https://www.npmjs.com/package/secure-store-redis)
[![license](https://img.shields.io/npm/l/secure-store-redis.svg)](https://github.com/silverbucket/secure-store-redis/blob/master/LICENSE)
[![build](https://github.com/silverbucket/secure-store-redis/actions/workflows/compliance.yml/badge.svg)](https://github.com/silverbucket/secure-store-redis/actions)

Encrypt and store data in Redis. Uses AES-256-GCM encryption with unique IVs per entry.

## Installation

```bash
npm install secure-store-redis
```

## Quick Start

```typescript
import SecureStore, { SecretValidator } from "secure-store-redis";

const store = new SecureStore({
    uid: "myApp",
    secret: SecretValidator.generate(),
    redis: { url: "redis://localhost:6379" },
});

await store.connect();
await store.save("key", { foo: "bar" });
const data = await store.get("key");
await store.disconnect();
```

## API

### Constructor

```typescript
new SecureStore(config: SecureStoreConfig)
```

| Option             | Type                            | Required | Description                                                       |
| ------------------ | ------------------------------- | -------- | ----------------------------------------------------------------- |
| `uid`              | string                          | Yes      | Unique prefix for Redis keys (e.g., `"myApp"`, `"myApp:sessions"`) |
| `secret`           | string                          | Yes      | 32-character encryption secret. Use `SecretValidator.generate()`. |
| `redis`            | RedisOptions \| { url: string } \| { client: Redis \| Cluster } | Yes      | Redis connection config or existing client                        |
| `allowWeakSecrets` | boolean                         | No       | Bypass secret strength validation (default: false)                |

### Using an Existing Redis Client

You can pass your own ioredis `Redis` or `Cluster` client instead of connection options. This enables connection sharing, pre-configured clients, and integration with existing Redis infrastructure.

```typescript
import { Redis } from "ioredis";
import SecureStore, { SecretValidator } from "secure-store-redis";

const redis = new Redis({ host: "localhost", port: 6379 });

const store = new SecureStore({
    uid: "myApp",
    secret: SecretValidator.generate(),
    redis: { client: redis },
});

await store.connect();
await store.save("key", "value");
await store.disconnect();

// Your client is still connected - you manage its lifecycle
console.log(redis.status); // "ready"
await redis.quit();
```

#### Redis Cluster

```typescript
import { Cluster } from "ioredis";
import SecureStore, { SecretValidator } from "secure-store-redis";

const cluster = new Cluster([
    { host: "node1", port: 6379 },
    { host: "node2", port: 6379 },
]);

const store = new SecureStore({
    uid: "myApp",
    secret: SecretValidator.generate(),
    redis: { client: cluster },
});

await store.connect();
```

#### Sharing Connections

Multiple SecureStore instances can share a single Redis connection:

```typescript
const redis = new Redis();

const sessionsStore = new SecureStore({
    uid: "sessions",
    secret: sessionSecret,
    redis: { client: redis },
});

const cacheStore = new SecureStore({
    uid: "cache",
    secret: cacheSecret,
    redis: { client: redis },
});

await sessionsStore.connect();
await cacheStore.connect();

// Both stores use the same connection
// Disconnecting either store does NOT close the Redis client
```

**Important notes:**
- When using an external client, `disconnect()` will NOT close the Redis connection - you are responsible for calling `redis.quit()` when done
- The client can be in any connectable state (ready, connecting, or lazyConnect); `connect()` will wait for it to be ready
- If the client is already closed, `connect()` will throw a `ConnectionError`

### Methods

#### `connect(): Promise<void>`

Connect to Redis. Must be called before other operations.

#### `save<T>(key: string, data: T, postfix?: string): Promise<void>`

Encrypt and store data.

#### `get<T>(key: string, postfix?: string): Promise<T | null>`

Retrieve and decrypt data. Returns `null` if not found or decryption fails.

#### `delete(key: string, postfix?: string): Promise<number>`

Delete data. Returns count of deleted keys.

#### `disconnect(client?: Redis): Promise<void>`

Close Redis connection. Optionally pass a specific Redis client to disconnect.

#### `namespace<TSchema>(name: string): TypedNamespace<TSchema>`

Create a typed namespace for organizing data. See [Namespaces](#namespaces) for details.

### Properties

- `client: RedisClient | undefined` - The underlying ioredis client (Redis or Cluster)
- `isConnected: boolean` - Connection status

## Namespaces

Namespaces allow you to organize data with type-safe operations. Each namespace acts as an isolated partition within the same store.

```typescript
const store = new SecureStore({
    uid: "myApp",
    secret: SecretValidator.generate(),
    redis: { url: "redis://localhost:6379" },
});
await store.connect();

// Create a typed namespace
interface UserSchema {
    profile: { name: string; age: number };
    settings: { theme: string; notifications: boolean };
}

const users = store.namespace<UserSchema>("users");

// Type-safe operations
await users.save("profile", { name: "John", age: 30 });
await users.save("settings", { theme: "dark", notifications: true });

const profile = await users.get("profile"); // { name: string; age: number } | null
const settings = await users.get("settings");

await users.delete("profile");
```

### Namespace Methods

Each namespace provides the same core operations as the store:

- `get<K>(key: K): Promise<T[K] | null>`
- `save<K>(key: K, data: T[K]): Promise<void>`
- `delete<K>(key: K): Promise<number>`

### Namespace Isolation

Data in different namespaces is completely isolated:

```typescript
const users = store.namespace("users");
const sessions = store.namespace("sessions");

await users.save("data", "user-data");
await sessions.save("data", "session-data");

await users.get("data");    // "user-data"
await sessions.get("data"); // "session-data"
await store.get("data");    // null (root store is separate)
```

## SecretValidator

Utility class for generating and validating encryption secrets.

### Methods

#### `generate(length?: number): string`

Generate a cryptographically secure secret. Defaults to 32 characters if no length specified.

#### `validate(secret: string): { valid: boolean; reason?: string }`

Validate secret strength against security requirements.

### Validation Rules

Secrets must:
- Be exactly 32 characters
- Have sufficient entropy (Shannon entropy ≥ 4.0)
- Not contain weak patterns (repeated chars, sequential numbers, etc.)
- Contain at least 3 of: uppercase, lowercase, numbers, special characters

## Error Handling

All errors extend `SecureStoreError` and include a `code` property for programmatic handling.

```typescript
import {
    SecureStoreError,
    ConnectionError,
    EncryptionError,
    ValidationError,
} from "secure-store-redis";

try {
    await store.connect();
} catch (err) {
    if (err instanceof ConnectionError) {
        console.error(`Connection failed (${err.code}):`, err.message);
        // err.code === "CONNECTION_ERROR"
    }
}
```

| Error Class       | Code                 | When Thrown                          |
| ----------------- | -------------------- | ------------------------------------ |
| `ConnectionError` | `CONNECTION_ERROR`   | Redis connection failures            |
| `EncryptionError` | `ENCRYPTION_ERROR`   | Encryption/decryption failures       |
| `ValidationError` | `VALIDATION_ERROR`   | Invalid configuration, keys, or data |

## Security Best Practices

- Store secrets in environment variables, not code
- Use `SecretValidator.generate()` for cryptographically secure secrets
- Enable Redis authentication and TLS in production
- Use unique `uid` values per application/environment to prevent data collisions
- Rotate secrets periodically (requires re-encryption of existing data)

## Migration from v3.x

### Breaking Changes

| Change               | Migration                                  |
| -------------------- | ------------------------------------------ |
| `uid` required       | Add explicit `uid` to constructor          |
| `secret` required    | Use `SecretValidator.generate()` or provide your own |
| `connect()` required | Call `await store.connect()` before use    |
| AES-256-GCM          | Re-encrypt existing data (format changed)  |
| Secret validation    | Use strong secrets or set `allowWeakSecrets: true` |

### Example

```typescript
// v3.x
const store = new SecureStore({ redis: { url: "..." } });
await store.init();

// v4.0
const store = new SecureStore({
    uid: "myApp",
    secret: SecretValidator.generate(),
    redis: { url: "..." },
});
await store.connect();
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import SecureStore, {
    SecureStoreConfig,
    TypedNamespace,
    RedisClient,
    SecretValidator,
    SecureStoreError,
    ConnectionError,
    EncryptionError,
    ValidationError,
} from "secure-store-redis";
```

## License

MIT
