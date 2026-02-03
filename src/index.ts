import {
    type BinaryLike,
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";
import debug from "debug";
import { type Cluster, Redis, type RedisOptions } from "ioredis";

/**
 * A Redis-like client that supports the commands SecureStore needs.
 * Can be either a standard Redis client or a Redis Cluster client.
 */
export type RedisClient = Redis | Cluster;

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const log = debug("secure-store-redis");

/**
 * Base error class for SecureStore
 */
export class SecureStoreError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = "SecureStoreError";
    }
}

/**
 * Connection-related errors
 */
export class ConnectionError extends SecureStoreError {
    constructor(message: string, cause?: Error) {
        super(message, "CONNECTION_ERROR");
        this.name = "ConnectionError";
        if (cause) {
            this.cause = cause;
        }
    }
}

/**
 * Encryption/decryption errors
 */
export class EncryptionError extends SecureStoreError {
    constructor(message: string, cause?: Error) {
        super(message, "ENCRYPTION_ERROR");
        this.name = "EncryptionError";
        if (cause) {
            this.cause = cause;
        }
    }
}

/**
 * Configuration validation errors
 */
export class ValidationError extends SecureStoreError {
    constructor(message: string) {
        super(message, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}

/**
 * Secret validation utilities
 */
export class SecretValidator {
    /**
     * Calculate Shannon entropy of a string
     */
    private static calculateEntropy(secret: string): number {
        const freq: { [key: string]: number } = {};
        for (const char of secret) {
            freq[char] = (freq[char] || 0) + 1;
        }

        let entropy = 0;
        for (const count of Object.values(freq)) {
            const probability = count / secret.length;
            entropy -= probability * Math.log2(probability);
        }

        return entropy;
    }

    /**
     * Check if secret contains common weak patterns
     */
    private static hasWeakPatterns(secret: string): boolean {
        const weakPatterns = [
            /^[a-zA-Z]+$/, // all letters
            /^[0-9]+$/, // all numbers
            /^(.)\1*$/, // repeated character
            /^123+/, // sequential numbers
            /^abc+/i, // sequential letters
            /^qwerty+/i, // keyboard patterns
        ];

        return weakPatterns.some((pattern) => pattern.test(secret));
    }

    /**
     * Validate secret strength
     */
    static validate(secret: string): { valid: boolean; reason?: string } {
        if (typeof secret !== "string") {
            return { valid: false, reason: "Secret must be a string" };
        }

        if (secret.length !== 32) {
            return {
                valid: false,
                reason: "Secret must be exactly 32 characters",
            };
        }

        if (SecretValidator.hasWeakPatterns(secret)) {
            return {
                valid: false,
                reason: "Secret contains common weak patterns",
            };
        }

        const entropy = SecretValidator.calculateEntropy(secret);
        const minEntropy = 4.0; // Minimum entropy threshold

        if (entropy < minEntropy) {
            return {
                valid: false,
                reason: `Secret entropy too low (${entropy.toFixed(2)} < ${minEntropy})`,
            };
        }

        // Check character variety
        const hasUpperCase = /[A-Z]/.test(secret);
        const hasLowerCase = /[a-z]/.test(secret);
        const hasNumbers = /[0-9]/.test(secret);
        const hasSpecial = /[^a-zA-Z0-9]/.test(secret);

        if (
            [hasUpperCase, hasLowerCase, hasNumbers, hasSpecial].filter(Boolean)
                .length < 3
        ) {
            return {
                valid: false,
                reason: "Secret should contain at least 3 of: uppercase, lowercase, numbers, special characters",
            };
        }

        return { valid: true };
    }

    /**
     * Generate cryptographically secure secret.
     * Uses a mix of uppercase, lowercase, numbers, and special characters.
     * @param length - Number of characters to generate (defaults to 32)
     */
    static generate(length = 32): string {
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        const charsLength = chars.length;
        // Use rejection sampling to avoid modulo bias
        const maxValidByte = 256 - (256 % charsLength);

        let secret = "";
        while (secret.length < length) {
            const bytes = randomBytes(64);
            for (const byte of bytes) {
                if (byte < maxValidByte) {
                    secret += chars[byte % charsLength];
                    if (secret.length === length) break;
                }
            }
        }
        return secret;
    }
}

/**
 * Possible Config parameters for SecureStore constructor
 */
export interface SecureStoreConfig {
    /**
     * A unique ID which is used to prefix data stored in Redis.
     */
    uid: string;
    /**
     * A 32 character encryption secret.
     * Use SecretValidator.generate() to create a cryptographically secure secret.
     */
    secret: string;
    /**
     * Redis connection configuration. Accepts one of:
     * - `RedisOptions`: ioredis connection options (host, port, etc.)
     * - `{ url: string }`: Redis connection URL
     * - `{ client: RedisClient }`: An existing Redis or Cluster client instance
     *
     * When providing an external client:
     * - SecureStore will NOT close the client on `disconnect()` - you manage its lifecycle
     * - The client should be connected or in a connectable state
     * - Both `Redis` and `Cluster` clients are supported
     */
    redis: RedisOptions | { url: string } | { client: RedisClient };
    /**
     * Allow weak secrets (bypass entropy validation). Not recommended for production.
     * @default false
     */
    allowWeakSecrets?: boolean;
}

/**
 * Typed namespace interface for type-safe operations
 */
export interface TypedNamespace<
    TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
    get<K extends keyof TSchema>(key: K): Promise<TSchema[K] | null>;
    save<K extends keyof TSchema>(key: K, data: TSchema[K]): Promise<void>;
    delete<K extends keyof TSchema>(key: K): Promise<number>;
}

/**
 * SecureStore class
 *
 * Automatically encrypt any data saved to redis
 *
 * @export
 * @class SecureStore
 */
export default class SecureStore {
    /**
     * Redis client
     */
    client: RedisClient | undefined;
    private readonly config: Required<SecureStoreConfig>;
    private connected = false;
    private externalClientProvided = false;

    /**
     * Creates an instance of SecureStore.
     *
     * @constructor
     */
    constructor(cfg: SecureStoreConfig) {
        if (typeof cfg.redis !== "object") {
            cfg.redis = {};
        }
        // Check for external client before secret validation
        if ("client" in cfg.redis && cfg.redis.client) {
            this.client = cfg.redis.client;
            this.externalClientProvided = true;
        }
        // Validate secret unless allowWeakSecrets is true
        if (!cfg.allowWeakSecrets) {
            const validation = SecretValidator.validate(cfg.secret);
            if (!validation.valid) {
                throw new ValidationError(
                    `Invalid secret: ${validation.reason}`,
                );
            }
        }
        cfg.allowWeakSecrets = cfg.allowWeakSecrets ?? false;
        this.config = cfg as Required<SecureStoreConfig>;
    }

    /**
     * Disconnects the Redis client.
     * If using an external client (passed via `{ client: RedisClient }`),
     * this method will NOT close the connection - you manage its lifecycle.
     */
    async disconnect(
        client: RedisClient | undefined = this.client,
    ): Promise<void> {
        if (client) {
            if (this.externalClientProvided && client === this.client) {
                log("Skipping quit for external client");
            } else {
                log("Redis client quit called");
                await client.quit();
                if (client === this.client) {
                    this.client = undefined;
                }
            }
            this.connected = false;
        }
    }

    /**
     * Check if connected to Redis
     */
    get isConnected(): boolean {
        return this.connected && this.client !== undefined;
    }

    /**
     * Connects the Redis client to the Redis server.
     * If using an external client, ensures the client is ready.
     */
    async connect(): Promise<void> {
        // Handle external client
        if (this.externalClientProvided && this.client) {
            const status = this.client.status;
            if (status === "ready") {
                this.connected = true;
                return;
            }
            // "end" is the terminal state after quit(). "close" can occur from
            // connection errors or manual disconnect. Both indicate unusable client.
            if (status === "close" || status === "end") {
                throw new ConnectionError(
                    "External Redis client is closed. Provide a connected client or reconnect before calling connect().",
                );
            }
            // wait/connecting/reconnecting - wait for ready event
            return new Promise((resolve, reject) => {
                const onReady = () => {
                    this.client?.off("error", onError);
                    this.connected = true;
                    resolve();
                };
                const onError = (err: Error) => {
                    this.client?.off("ready", onReady);
                    reject(
                        new ConnectionError(
                            "External client failed to connect",
                            err,
                        ),
                    );
                };
                this.client?.once("ready", onReady);
                this.client?.once("error", onError);
                // Initiate connection if client is waiting (lazyConnect)
                if (status === "wait") {
                    this.client?.connect().catch(onError);
                }
            });
        }

        // Create internal client
        if (!this.client) {
            return new Promise((resolve, reject) => {
                let redisConfig: RedisOptions = {};

                // Compatibility: convert node-redis style { url: "..." } to ioredis format
                if (
                    this.config.redis &&
                    "url" in this.config.redis &&
                    typeof this.config.redis.url === "string"
                ) {
                    const url = new URL(this.config.redis.url);
                    redisConfig = {
                        host: url.hostname,
                        port: url.port ? Number.parseInt(url.port, 10) : 6379,
                        username: url.username || undefined,
                        password: url.password || undefined,
                        db:
                            url.pathname.length > 1
                                ? Number.parseInt(url.pathname.slice(1), 10)
                                : 0,
                    };
                } else if (
                    this.config.redis &&
                    !("client" in this.config.redis)
                ) {
                    redisConfig = this.config.redis as RedisOptions;
                }

                const client = new Redis({
                    ...redisConfig,
                    lazyConnect: true,
                });

                client.on("error", (err: Error) => {
                    log("Redis connection error", err);
                });

                client
                    .connect()
                    .then(() => {
                        log("Connected to Redis");
                        this.client = client;
                        this.connected = true;
                        resolve();
                    })
                    .catch((err: Error) => {
                        client.disconnect();
                        this.connected = false;
                        reject(
                            new ConnectionError(
                                "Failed to connect to Redis",
                                err,
                            ),
                        );
                    });
            });
        }
    }

    /**
     * Save and encrypt arbitrary data to Redis
     */
    async save<T = unknown>(key: string, data: T, postfix = ""): Promise<void> {
        if (typeof key !== "string") {
            throw new ValidationError("No hash key specified");
        }
        if (data === undefined || data === null) {
            throw new ValidationError("No data provided, nothing to save");
        }
        const suffix = postfix ? `:${postfix}` : "";

        let serializedData: string;
        if (typeof data === "object") {
            try {
                serializedData = JSON.stringify(data);
            } catch (e) {
                throw new ValidationError(
                    e instanceof Error ? e.message : String(e),
                );
            }
        } else {
            serializedData = String(data);
        }

        if (!this.isConnected) {
            throw new ConnectionError(
                "Not connected to Redis. Call await store.connect() first.",
            );
        }
        const encryptedData = this.encrypt(serializedData);
        const hash = SecureStore.shasum(key);
        await this.client?.hset(this.config.uid + suffix, hash, encryptedData);
    }

    /**
     * Get and decrypt arbitrary data from Redis
     */
    async get<T = unknown>(key: string, postfix = ""): Promise<T | null> {
        if (typeof key !== "string") {
            throw new ValidationError("No hash key specified");
        }
        const suffix = postfix ? `:${postfix}` : "";

        if (!this.isConnected) {
            throw new ConnectionError(
                "Not connected to Redis. Call await store.connect() first.",
            );
        }
        const hash = SecureStore.shasum(key);
        const res = await this.client?.hget(this.config.uid + suffix, hash);

        if (typeof res !== "string") {
            return null;
        }

        try {
            const decryptedData = this.decrypt(res);

            try {
                return JSON.parse(decryptedData) as T;
            } catch {
                // Return as string if JSON parsing fails
                return decryptedData as T;
            }
        } catch (err) {
            log("Failed to decrypt data. ", err);
            // Return null for decryption failures (wrong key, corrupted data) to maintain backward compatibility
            return null;
        }
    }

    /**
     * Delete arbitrary data from Redis
     */
    async delete(key: string, postfix = ""): Promise<number> {
        if (typeof key !== "string") {
            throw new ValidationError("No hash key specified");
        }
        const suffix = postfix ? `:${postfix}` : "";
        if (!this.isConnected) {
            throw new ConnectionError(
                "Not connected to Redis. Call await store.connect() first.",
            );
        }
        const hash = SecureStore.shasum(key);
        // biome-ignore lint/style/noNonNullAssertion: client is guaranteed to exist after isConnected check
        return this.client!.hdel(this.config.uid + suffix, hash);
    }

    /**
     * Encrypts arbitrary data, returning an encrypted string
     */
    private encrypt(data: unknown): string {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(
            ALGORITHM,
            Buffer.from(this.config.secret),
            iv,
            { authTagLength: AUTH_TAG_LENGTH },
        );
        let encrypted = cipher.update(data as BinaryLike);

        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Format: iv:auth_tag:encrypted_data
        return [
            iv.toString("hex"),
            authTag.toString("hex"),
            encrypted.toString("hex"),
        ].join(":");
    }

    /**
     * Decrypts given encrypted string, returning its arbitrary data
     */
    private decrypt(encrypted: string): string {
        const parts = encrypted.split(":");
        if (parts.length !== 3) {
            throw new EncryptionError("Invalid encrypted data format");
        }

        const [ivPart, authTagPart, encryptedTextPart] = parts;
        try {
            const iv = Buffer.from(ivPart, "hex");
            const authTag = Buffer.from(authTagPart, "hex");
            const encryptedText = Buffer.from(encryptedTextPart, "hex");

            const decipher = createDecipheriv(
                ALGORITHM,
                Buffer.from(this.config.secret),
                iv,
                { authTagLength: AUTH_TAG_LENGTH },
            );

            // Set authentication tag for GCM
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString();
        } catch (err) {
            throw new EncryptionError(
                "Decryption failed - data may be corrupted or using wrong key",
                err instanceof Error ? err : new Error(String(err)),
            );
        }
    }

    /**
     * Create a typed namespace for type-safe operations.
     * Data is stored with the namespace as a postfix to the uid.
     */
    namespace<
        TSchema extends Record<string, unknown> = Record<string, unknown>,
    >(name: string): TypedNamespace<TSchema> {
        if (!name || typeof name !== "string") {
            throw new ValidationError(
                "Namespace name must be a non-empty string",
            );
        }
        return {
            get: async <K extends keyof TSchema>(key: K) => {
                return this.get<TSchema[K]>(String(key), name);
            },
            save: async <K extends keyof TSchema>(key: K, data: TSchema[K]) => {
                await this.save(String(key), data, name);
            },
            delete: async <K extends keyof TSchema>(key: K) => {
                return this.delete(String(key), name);
            },
        } as TypedNamespace<TSchema>;
    }

    /**
     * Generate sha256 sum from given text
     */
    private static shasum(text: string): string {
        const s = createHash("sha256");
        s.update(text);
        return s.digest("hex");
    }
}
