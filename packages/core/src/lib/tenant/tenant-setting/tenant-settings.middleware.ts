import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Cache } from 'cache-manager';
import { environment } from '@gauzy/config';
import { isAccessTokenPayload, JWT_ALGORITHMS } from '../../auth/purpose-token';
import { TenantSettingService } from './tenant-setting.service';

/**
 * What the middleware attaches to a request: the tenant's own settings and the resolved ones (global rows
 * overridden by the tenant's). Cached together, under one key per tenant, so a request costs one cache read.
 */
export interface TenantSettingsBundle {
	readonly tenantSettings: Record<string, any>;
	readonly resolvedSettings: Record<string, any>;
}

/** How long a tenant's settings are kept once something is set. Settings apply within this window. */
export const TENANT_SETTINGS_TTL_MS = 5 * 60 * 1000;

/**
 * How long an EMPTY answer is kept. A tenant with no settings of its own on an installation with no global
 * ones — the common case — used to pay the queries again on every request; nothing evicts the entry when a
 * setting is saved, so an empty answer is kept for one minute only: a tenant's first setting still applies
 * within a minute, and the queries run at most once a minute.
 */
export const EMPTY_TENANT_SETTINGS_TTL_MS = 60 * 1000;

/**
 * The tenant named by a bearer token, when the token is an access token this API signed; otherwise none.
 *
 * The settings attached from it are not hints: the file storage providers sign and upload with the tenant's own
 * credentials and bucket from them. This middleware runs before any guard, and on a `@Public` route nothing else
 * checks the token, so a decoded (unverified) token let anyone name another tenant and have its storage
 * credentials used for their request. Each new name also cost two queries and a cache entry.
 *
 * @param token - The bearer token of the request.
 */
export function tenantIdOfAccessToken(token: string | undefined): string | undefined {
	if (!token) {
		return undefined;
	}

	let payload: string | jwt.JwtPayload;
	try {
		payload = jwt.verify(token, environment.JWT_SECRET, { algorithms: JWT_ALGORITHMS });
	} catch {
		return undefined;
	}

	// A token minted for another flow (password reset, invoice share, ...) does not stand for a session.
	if (!isAccessTokenPayload(payload)) {
		return undefined;
	}

	// Only a string names a tenant (an object would reach `where` and the cache key as-is).
	const tenantId = (payload as jwt.JwtPayload).tenantId;
	return typeof tenantId === 'string' ? tenantId : undefined;
}

@Injectable()
export class TenantSettingsMiddleware implements NestMiddleware {
	private logging = false;

	/** Cache key prefix of the per-tenant bundle. */
	private static readonly CACHE_KEY_PREFIX = 'tenantSettingsBundle_';

	/**
	 * The loads in flight, by tenant. This middleware runs on every route: when a tenant's entry expires, all
	 * of its requests that arrive together miss at once and would each run the two queries; they share one.
	 */
	private readonly loading = new Map<string, Promise<TenantSettingsBundle>>();

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly tenantSettingService: TenantSettingService
	) {}

	/**
	 * Middleware to retrieve and cache tenant settings based on the JWT token in the request headers.
	 *
	 * Attaches `tenantSettings` (the tenant's own settings; an empty object when the token names no tenant or
	 * the tenant has none) and, when there are any, `resolvedSettings` (global settings overridden by the
	 * tenant's). Only a token this API signed names the tenant: see {@link tenantIdOfAccessToken}.
	 *
	 * @param {Request} _request - The incoming HTTP request object.
	 * @param {Response} _response - The outgoing HTTP response object.
	 * @param {NextFunction} next - The next middleware function to call.
	 *
	 * @returns {Promise<void>} - Proceeds to the next middleware after attaching tenant settings to the request.
	 *
	 * @throws {Error} - Logs errors if tenant settings retrieval fails.
	 */
	async use(_request: Request, _response: Response, next: NextFunction): Promise<void> {
		try {
			const authHeader = _request.headers.authorization;

			if (authHeader) {
				const tenantId = tenantIdOfAccessToken(authHeader.split(' ')[1]);

				let tenantSettings: Record<string, any> = {};

				if (tenantId) {
					if (this.logging) {
						console.log('Getting Tenant settings for tenantId: %s', tenantId);
					}

					const bundle = await this.settingsOf(tenantId);
					tenantSettings = bundle.tenantSettings;

					// Load resolved settings (Global DB + Tenant DB cascade)
					if (Object.keys(bundle.resolvedSettings).length > 0) {
						_request['resolvedSettings'] = bundle.resolvedSettings;
					}
				}

				// Attach tenant settings to request
				_request['tenantSettings'] = tenantSettings;
			}
		} catch (error) {
			console.error('Error while getting Tenant settings: %s', error?.message);
			console.error(_request.path, _request.url);
		}

		next();
	}

	/**
	 * The settings bundle of a tenant: from the cache, or loaded once for every request that misses together.
	 *
	 * @param tenantId - The tenant named by the token.
	 */
	private async settingsOf(tenantId: string): Promise<TenantSettingsBundle> {
		const cacheKey = `${TenantSettingsMiddleware.CACHE_KEY_PREFIX}${tenantId}`;

		const cached = await this.cacheManager.get<TenantSettingsBundle>(cacheKey);
		if (cached) {
			if (this.logging) {
				console.log('Tenant settings loaded from Cache for tenantId: %s', tenantId);
			}
			return cached;
		}

		const loading = this.loading.get(tenantId);
		if (loading) {
			return loading;
		}

		const load = this.loadSettings(tenantId, cacheKey).finally(() => {
			this.loading.delete(tenantId);
		});
		this.loading.set(tenantId, load);
		return load;
	}

	/**
	 * Reads the global (tenantId = NULL) and the tenant's own settings — one query each, at the same time —
	 * and caches them together: for {@link TENANT_SETTINGS_TTL_MS}, or {@link EMPTY_TENANT_SETTINGS_TTL_MS}
	 * when the tenant ends up with no settings at all.
	 *
	 * @param tenantId - The tenant.
	 * @param cacheKey - Where the bundle is cached.
	 */
	private async loadSettings(tenantId: string, cacheKey: string): Promise<TenantSettingsBundle> {
		if (this.logging) {
			console.log('Tenant settings NOT loaded from Cache for tenantId: %s', tenantId);
		}

		const [globalSettings, tenantSettings] = await Promise.all([
			this.tenantSettingService.getGlobalSettings(),
			this.tenantSettingService.getSettings({ where: { tenantId } })
		]);

		const bundle: TenantSettingsBundle = {
			tenantSettings: tenantSettings ?? {},
			resolvedSettings: { ...globalSettings, ...tenantSettings }
		};

		const isEmpty = Object.keys(bundle.resolvedSettings).length === 0;
		await this.cacheManager.set(cacheKey, bundle, isEmpty ? EMPTY_TENANT_SETTINGS_TTL_MS : TENANT_SETTINGS_TTL_MS);

		if (this.logging) {
			console.log('Tenant settings loaded from DB and stored in Cache for tenantId: %s', tenantId);
		}

		return bundle;
	}
}
