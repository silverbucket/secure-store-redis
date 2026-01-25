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

| Option             | Type                            | Required | Description                                       |
| ------------------ | ------------------------------- | -------- | ------------------------------------------------- |
| `uid`              | string                          | Yes      | Prefix for Redis keys                             |
| `secret`           | string                          | Yes      | 32-character encryption secret                    |
| `redis`            | RedisOptions \| { url: string } | Yes      | Redis connection config                           |
| `allowWeakSecrets` | boolean                         | No       | Bypass secret strength validation (default false) |

### Methods

#### `connect(): Promise<void>`

Connect to Redis. Must be called before other operations.

#### `save<T>(key: string, data: T, postfix?: string): Promise<void>`

Encrypt and store data.

#### `get<T>(key: string, postfix?: string): Promise<T | null>`

Retrieve and decrypt data. Returns `null` if not found.

#### `delete(key: string, postfix?: string): Promise<number>`

Delete data. Returns count of deleted keys.

#### `disconnect(): Promise<void>`

Close Redis connection.

#### `namespace<T>(name: string): TypedNamespace<T>`

Create a typed namespace for type-safe operations.

```typescript
interface UserSchema {
    profile: { name: string; age: number };
    settings: { theme: string };
}

const users = store.namespace<UserSchema>("users");
await users.save("profile", { name: "John", age: 30 });
const profile = await users.get("profile");
```

### Properties

- `client: Redis | undefined` - The underlying ioredis client
- `isConnected: boolean` - Connection status

### SecretValidator

```typescript
// Generate a secure 32-character secret
const secret = SecretValidator.generate();

// Validate secret strength
const result = SecretValidator.validate(secret);
// { valid: true } or { valid: false, reason: "..." }
```

### Error Classes

- `SecureStoreError` - Base error class
- `ConnectionError` - Redis connection failures
- `EncryptionError` - Encryption/decryption failures
- `ValidationError` - Invalid configuration or input

## Security

- Store secrets in environment variables, not code
- Use `SecretValidator.generate()` for cryptographically secure secrets
- Enable Redis authentication and TLS in production
- Rotate secrets periodically

## Migration from v3.x

### Breaking Changes

| Change               | Migration                                 |
| -------------------- | ----------------------------------------- |
| `uid` required       | Add explicit `uid` to constructor         |
| `connect()` required | Call `await store.connect()` before use   |
| AES-256-GCM          | Re-encrypt existing data (format changed) |
| Secret validation    | Use strong secrets or `allowWeakSecrets`  |

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

## License

MIT
