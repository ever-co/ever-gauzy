import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Cache Service for managing application-wide caching
 * Uses Keyv Redis adapter for persistent caching
 */
@Injectable()
export class CacheService {
	private readonly logger = new Logger(CacheService.name);
	constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

	/**
	 * Get a value from cache
	 * @param key - The cache key
	 * @returns The cached value or undefined
	 */
	async get<T = any>(key: string): Promise<T | undefined> {
		try {
			return await this.cacheManager.get<T>(key);
		} catch (error) {
			this.logger.error(`get(${key}) failed`, error);
			return undefined;
		}
	}

	/**
	 * Set a value in cache
	 * @param key - The cache key
	 * @param value - The value to cache
	 * @param ttl - Time to live in milliseconds (optional)
	 */
	async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
		try {
			await this.cacheManager.set(key, value, ttl);
		} catch (error) {
			this.logger.error(`set(${key}) failed`, error);
		}
	}

	/**
	 * Delete a value from cache
	 * @param key - The cache key
	 */
	async delete(key: string): Promise<void> {
		try {
			await this.cacheManager.del(key);
		} catch (error) {
			this.logger.error(`del(${key}) failed`, error);
		}
	}

	/**
	 * Clear all cache entries
	 */
	async clear(): Promise<void> {
		try {
			if (typeof (this.cacheManager as any).clear === 'function') {
				await (this.cacheManager as any).clear();
			} else {
				await (this.cacheManager as any).reset?.();
			}
		} catch (error) {
			this.logger.error('clear() failed', error);
		}
	}

	/**
	 * Get multiple values from cache
	 * @param keys - Array of cache keys
	 * @returns Array of cached values
	 */
	async getMany<T = any>(keys: string[]): Promise<(T | undefined)[]> {
		try {
			return await Promise.all(keys.map((key) => this.get<T>(key)));
		} catch (error) {
			this.logger.error('getMany() failed', error);
			return keys.map(() => undefined);
		}
	}

	/**
	 * Set multiple values in cache
	 * @param entries - Array of [key, value] tuples
	 * @param ttl - Time to live in milliseconds (optional)
	 */
	async setMany<T = any>(entries: Array<[string, T]>, ttl?: number): Promise<void> {
		try {
			await Promise.all(entries.map(([key, value]) => this.set(key, value, ttl)));
		} catch (error) {
			this.logger.error('setMany() failed', error);
		}
	}

	/**
	 * Delete multiple values from cache
	 * @param keys - Array of cache keys
	 */
	async deleteMany(keys: string[]): Promise<void> {
		try {
			await Promise.all(keys.map((key) => this.delete(key)));
		} catch (error) {
			this.logger.error('deleteMany() failed', error);
		}
	}

	/**
	 * Check if a key exists in cache
	 * @param key - The cache key
	 * @returns True if key exists, false otherwise
	 */
	async has(key: string): Promise<boolean> {
		try {
			const value = await this.get(key);
			return value !== undefined;
		} catch (error) {
			this.logger.error(`has(${key}) failed`, error);
			return false;
		}
	}
}
