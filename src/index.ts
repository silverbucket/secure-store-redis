import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "crypto";
import {
  createClient,
  RedisClientOptions,
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from "redis";

import debug from "debug";

const log = debug("secure-store-redis");

const ALGORITHM = "aes-256-cbc",
  IV_LENGTH = 16;

interface SecureStoreConfig {
  redis: RedisClientOptions;
}

export default class SecureStore {
  uid: string;
  secret: string;
  client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>;
  private config: SecureStoreConfig;

  constructor(uid: string, secret: string, cfg: SecureStoreConfig) {
    if (typeof uid !== "string") {
      throw new Error("A uid must be specified");
    } else if (typeof secret !== "string") {
      throw new Error("No secret specified");
    } else if (secret.length !== 32) {
      throw new Error("Secret must be 32 char string");
    }
    this.uid = uid;
    this.secret = secret;
    this.config = cfg;
  }

  async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  async init(): Promise<void> {
    if (this.client) {
      return Promise.resolve();
    } else {
      return new Promise((resolve, reject) => {
        const client = createClient(this.config.redis);
        client.on("error", (err) => {
          log("error connecting", err);
          return reject(err);
        });
        client.connect().then(() => {
          log("connected");
          this.client = client;
          resolve();
        });
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async save(key: string, data: any, postfix = "") {
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
        throw new Error(e);
      }
    }

    await this.init();
    data = this.encrypt(data);
    const hash = SecureStore.shasum(key);
    return this.client.HSET(this.uid + postfix, hash, data);
  }

  async get(key: string, postfix = "") {
    if (typeof key !== "string") {
      throw new Error("No hash key specified");
    }
    postfix = postfix ? ":" + postfix : "";

    await this.init();
    const hash = SecureStore.shasum(key);
    const res = await this.client.HGET(this.uid + postfix, hash);
    let data;
    if (typeof res === "string") {
      try {
        data = this.decrypt(res);
      } catch (e) {
        throw new Error(e);
      }

      try {
        data = JSON.parse(data);
        // eslint-disable-next-line no-empty
      } catch (e) {}
    } else {
      data = res;
    }
    return data;
  }

  async delete(key: string, postfix = "") {
    if (typeof key !== "string") {
      throw new Error("No hash key specified");
    }
    postfix = postfix ? ":" + postfix : "";
    await this.init();
    const hash = SecureStore.shasum(key);
    return this.client.HDEL(this.uid + postfix, hash);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private encrypt(data: any): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(this.secret), iv);
    let encrypted = cipher.update(data);

    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  }

  private decrypt(encrypted: string): string {
    const parts = encrypted.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(this.secret), iv);
    let decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  private static shasum(text: string): string {
    const s = createHash("sha256");
    s.update(text);
    return s.digest("hex");
  }
}
