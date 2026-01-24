# secure-store-redis

A simple wrapper to encrypt and decrypt data stored in redis.
The main point is to ensure that any data you store in redis cannot be accessed
by anyone else, without the key.

## v4.0.0 Breaking Changes

- **Redis client**: Switched from `node-redis` to `ioredis` for better error handling and reconnection logic
- **Node.js**: Minimum version is now Node 20
- **TypeScript**: Strict null checks enabled

The `client` property type has changed from `RedisClientType` to `Redis` (ioredis). The `{ url: "redis://..." }` configuration format is still supported for backward compatibility.

## API Reference

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

| Option   | Type                            | Required | Default                       | Description                    |
| -------- | ------------------------------- | -------- | ----------------------------- | ------------------------------ |
| `uid`    | string                          | No       | Auto-generated (4 hex chars)  | Prefix for Redis keys          |
| `secret` | string                          | No       | Auto-generated (32 hex chars) | 32-character encryption secret |
| `redis`  | RedisOptions \| { url: string } | Yes      | -                             | Redis connection configuration |

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

```typescript
// Good: Environment variable
const secret = process.env.SECURE_STORE_SECRET;

// Bad: Hardcoded secret
const secret = "hardcoded-secret-1234567890123456";
```

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
    uid: "myApp:store",
    secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
    redis: {
        url: "redis://localhost:6379",
    },
});

await store.init();
await store.save("quote", "hello world");
const data = await store.get("quote"); // 'hello world'
await store.delete("quote");
await store.disconnect();
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
