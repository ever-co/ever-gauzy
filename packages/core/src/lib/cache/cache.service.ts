import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Cache Service for managing application-wide caching
 * Uses Keyv Redis adapter for persistent caching
 */
@Injectable()
export class CacheService {
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
			console.error(`Error getting cache key ${key}:`, error);
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
			console.error(`Error setting cache key ${key}:`, error);
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
			console.error(`Error deleting cache key ${key}:`, error);
		}
	}

	/**
	 * Clear all cache entries
	 */
	async clear(): Promise<void> {
		try {
			// Use store's clear method if available, otherwise iterate and delete
			const store = (this.cacheManager as any).store;
			if (store && typeof store.clear === 'function') {
				await store.clear();
			} else {
				// Fallback: reset the cache manager
				await (this.cacheManager as any).reset?.();
			}
		} catch (error) {
			console.error('Error clearing cache:', error);
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
			console.error('Error getting multiple cache keys:', error);
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
			console.error('Error setting multiple cache keys:', error);
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
			console.error('Error deleting multiple cache keys:', error);
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
			console.error(`Error checking cache key ${key}:`, error);
			return false;
		}
	}
}
