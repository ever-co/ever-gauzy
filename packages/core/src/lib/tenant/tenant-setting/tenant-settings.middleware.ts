import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Cache } from 'cache-manager';
import { TenantSettingService } from './tenant-setting.service';

@Injectable()
export class TenantSettingsMiddleware implements NestMiddleware {
	private logging = false;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly tenantSettingService: TenantSettingService
	) {}

	/**
	 * Middleware to retrieve and cache tenant settings based on the JWT token in the request headers.
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
				const token = authHeader.split(' ')[1];

				// Decode JWT token
				const decodedToken: any = jwt.decode(token);
				let tenantSettings = {};

				if (decodedToken && decodedToken.tenantId) {
					if (this.logging) {
						console.log('Getting Tenant settings from Cache for tenantId: %s', decodedToken.tenantId);
					}

					const cacheKey = `tenantSettings_${decodedToken.tenantId}`;

					// Attempt to fetch from cache
					tenantSettings = await this.cacheManager.get(cacheKey);

					if (!tenantSettings) {
						if (this.logging) {
							console.log(
								'Tenant settings NOT loaded from Cache for tenantId: %s',
								decodedToken.tenantId
							);
						}

						// Fetch tenant settings from DB
						tenantSettings = await this.tenantSettingService.getSettings({
							where: { tenantId: decodedToken.tenantId }
						});

						if (tenantSettings) {
							const ttl = 5 * 60 * 1000; // Cache TTL: 5 minutes
							await this.cacheManager.set(cacheKey, tenantSettings, ttl);

							if (this.logging) {
								console.log(
									'Tenant settings loaded from DB and stored in Cache for tenantId: %s',
									decodedToken.tenantId
								);
							}
						}
					} else {
						if (this.logging) {
							console.log('Tenant settings loaded from Cache for tenantId: %s', decodedToken.tenantId);
						}
					}
				}

				if (tenantSettings) {
					// Attach tenant settings to request
					_request['tenantSettings'] = tenantSettings;
				}
			}
		} catch (error) {
			console.error('Error while getting Tenant settings: %s', error?.message);
			console.error(_request.path, _request.url);
		}

		next();
	}
}
