import {
    randomBytes,
    createCipheriv,
    createDecipheriv,
    createHash,
    BinaryLike,
} from "crypto";
import { Redis, RedisOptions } from "ioredis";
import debug from "debug";

const ALGORITHM = "aes-256-cbc",
    IV_LENGTH = 16;

const log = debug("secure-store-redis");

/**
 * Possible Config parameters for SecureStore constructor
 */
export interface SecureStoreConfig {
    /**
     * A unique ID which can be used to prefix data stored in Redis
     */
    uid?: string;
    /**
     * A 32 character encryption secret, it will be automatically generated if not provided
     */
    secret?: string;
    /**
     * Redis connect config object
     */
    redis?: RedisOptions | { url: string };
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

    /**
     * Creates an instance of SecureStore.
     *
     * @constructor
     */
    constructor(cfg: SecureStoreConfig) {
        if (typeof cfg.redis !== "object") {
            cfg.redis = {};
        }
        if (typeof cfg.uid !== "undefined") {
            if (typeof cfg.uid !== "string") {
                throw new Error("If specifying a UID, it must be a string");
            }
        } else {
            cfg.uid = randomBytes(4).toString("hex");
        }
        if (typeof cfg.secret !== "undefined") {
            if (typeof cfg.secret !== "string" || cfg.secret.length !== 32) {
                throw new Error(
                    `If specifying a secret, it must be a 32 char string (length: ${cfg.secret.length})`,
                );
            }
        } else {
            cfg.secret = randomBytes(16).toString("hex");
        }
        this.config = cfg as Required<SecureStoreConfig>;
    }

    /**
     * Disconnects the Redis client
     */
    async disconnect(client: Redis | undefined = this.client): Promise<void> {
        if (client) {
            log("Redis client quit called");
            await client.quit();
        }
    }

    /**
     * Initializes (connects) the Redis client to the Redis server
     */
    async init(): Promise<void> {
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
                        resolve();
                    })
                    .catch((err: Error) => {
                        client.disconnect();
                        reject(err);
                    });
            });
        }
    }

    /**
     * Save and encrypt arbitrary data to Redis
     */
    async save(key: string, data: unknown, postfix = "") {
        if (typeof key !== "string") {
            throw new Error("No hash key specified");
        } else if (!data) {
            throw new Error("No data provided, nothing to save");
        }
        postfix = postfix ? ":" + postfix : "";

        if (typeof data === "object") {
            try {
                data = JSON.stringify(data);
            } catch (e) {
                throw new Error(e instanceof Error ? e.message : String(e));
            }
        }

        await this.init();
        data = this.encrypt(data);
        const hash = SecureStore.shasum(key);
        return this.client!.hset(
            this.config.uid + postfix,
            hash,
            data as string,
        );
    }

    /**
     * Get and decrypt arbitrary data from Redis
     */
    async get(key: string, postfix = "") {
        if (typeof key !== "string") {
            throw new Error("No hash key specified");
        }
        postfix = postfix ? ":" + postfix : "";

        await this.init();
        const hash = SecureStore.shasum(key);
        const res = await this.client!.hget(this.config.uid + postfix, hash);
        let data;
        if (typeof res === "string") {
            try {
                data = this.decrypt(res);
            } catch (err) {
                log("Failed to decrypt data. ", err);
                return null;
            }

            try {
                data = JSON.parse(data);
            } catch (err) {
                log("Failed to parse dataset as JSON. ", err);
            }
        } else {
            data = res;
        }
        return data;
    }

    /**
     * Delete arbitrary data from Redis
     */
    async delete(key: string, postfix = "") {
        if (typeof key !== "string") {
            throw new Error("No hash key specified");
        }
        postfix = postfix ? ":" + postfix : "";
        await this.init();
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
        return iv.toString("hex") + ":" + encrypted.toString("hex");
    }

    /**
     * Decrypts given encrypted string, returning its arbitrary data
     */
    private decrypt(encrypted: string): string {
        const parts = encrypted.split(":");
        const ivPart = parts.shift();
        if (!ivPart) {
            throw new Error("Invalid encrypted data format");
        }
        const iv = Buffer.from(ivPart, "hex");
        const encryptedText = Buffer.from(parts.join(":"), "hex");
        const decipher = createDecipheriv(
            ALGORITHM,
            Buffer.from(this.config.secret),
            iv,
        );
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
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
