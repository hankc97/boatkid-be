import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Initialize Redis connection when module starts
    this.redisClient = new Redis({
      host: this.configService.get<string>("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      username: this.configService.get<string>("REDIS_USERNAME", "default"),
      password: this.configService.get<string>("REDIS_PASSWORD", ""),
      db: this.configService.get<number>("REDIS_DB", 0),
    });

    this.redisClient.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    this.redisClient.on("connect", () => {
      console.log("Successfully connected to Redis");
    });
  }

  async onModuleDestroy() {
    // Close Redis connection when application shuts down
    await this.redisClient.quit();
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  /**
   * Set a value in Redis with optional expiration time
   */
  async set(key: string, value: string, expireSeconds?: number): Promise<"OK"> {
    if (expireSeconds) {
      return this.redisClient.set(key, value, "EX", expireSeconds);
    }
    return this.redisClient.set(key, value);
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  /**
   * Check if a key exists in Redis
   */
  async exists(key: string): Promise<number> {
    return this.redisClient.exists(key);
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    return this.redisClient.expire(key, seconds);
  }

  /**
   * Get TTL (time to live) of a key
   */
  async ttl(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }

  /**
   * Increment a value in Redis
   */
  async incr(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  /**
   * Get the Redis client for advanced operations
   */
  getClient(): Redis {
    return this.redisClient;
  }
}
