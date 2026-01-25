import {
    randomBytes,
    createCipheriv,
    createDecipheriv,
    createHash,
    BinaryLike,
} from "crypto";
import { Redis, RedisOptions } from "ioredis";
import debug from "debug";

const ALGORITHM = "aes-256-gcm",
    IV_LENGTH = 16,
    AUTH_TAG_LENGTH = 16;

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

        if (this.hasWeakPatterns(secret)) {
            return {
                valid: false,
                reason: "Secret contains common weak patterns",
            };
        }

        const entropy = this.calculateEntropy(secret);
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
     * Generate cryptographically secure secret
     */
    static generate(): string {
        return randomBytes(16).toString("hex");
    }
}

/**
 * Possible Config parameters for SecureStore constructor
 */
export interface SecureStoreConfig {
    /**
     * A unique ID which can be used to prefix data stored in Redis
     */
    uid: string;
    /**
     * A 32 character encryption secret, it will be automatically generated if not provided
     */
    secret?: string;
    /**
     * Redis connect config object
     */
    redis: RedisOptions | { url: string };
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
    client: Redis | undefined;
    private readonly config: Required<SecureStoreConfig>;
    private connected = false;

    /**
     * Creates an instance of SecureStore.
     *
     * @constructor
     */
    constructor(cfg: SecureStoreConfig) {
        if (typeof cfg.redis !== "object") {
            cfg.redis = {};
        }
        // Set default for allowWeakSecrets
        cfg.allowWeakSecrets = cfg.allowWeakSecrets ?? false;
        this.config = cfg as Required<SecureStoreConfig>;
    }

    /**
     * Disconnects the Redis client
     */
    async disconnect(client: Redis | undefined = this.client): Promise<void> {
        if (client) {
            log("Redis client quit called");
            await client.quit();
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
     * Connects the Redis client to the Redis server
     */
    async connect(): Promise<void> {
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
                        port: url.port ? parseInt(url.port, 10) : 6379,
                        password: url.password || undefined,
                        db:
                            url.pathname.length > 1
                                ? parseInt(url.pathname.slice(1), 10)
                                : 0,
                    };
                } else if (this.config.redis) {
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
        } else if (!data) {
            throw new ValidationError("No data provided, nothing to save");
        }
        postfix = postfix ? ":" + postfix : "";

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
        await this.client!.hset(this.config.uid + postfix, hash, encryptedData);
    }

    /**
     * Get and decrypt arbitrary data from Redis
     */
    async get<T = unknown>(key: string, postfix = ""): Promise<T | null> {
        if (typeof key !== "string") {
            throw new ValidationError("No hash key specified");
        }
        postfix = postfix ? ":" + postfix : "";

        if (!this.isConnected) {
            throw new ConnectionError(
                "Not connected to Redis. Call await store.connect() first.",
            );
        }
        const hash = SecureStore.shasum(key);
        const res = await this.client!.hget(this.config.uid + postfix, hash);

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
    async delete<T = unknown>(key: string, postfix = ""): Promise<number> {
        if (typeof key !== "string") {
            throw new ValidationError("No hash key specified");
        }
        postfix = postfix ? ":" + postfix : "";
        if (!this.isConnected) {
            throw new ConnectionError(
                "Not connected to Redis. Call await store.connect() first.",
            );
        }
        const hash = SecureStore.shasum(key);
        return this.client!.hdel(this.config.uid + postfix, hash);
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
     * Create a typed namespace for type-safe operations
     */
    namespace<
        TSchema extends Record<string, unknown> = Record<string, unknown>,
    >(name: string): TypedNamespace<TSchema> {
        const postfix = name ? `:${name}` : "";

        return {
            get: async <K extends keyof TSchema>(key: K) => {
                return this.get<TSchema[K]>(String(key), postfix);
            },
            save: async <K extends keyof TSchema>(key: K, data: TSchema[K]) => {
                await this.save(String(key), data, postfix);
            },
            delete: async <K extends keyof TSchema>(key: K) => {
                return this.delete(String(key), postfix);
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
