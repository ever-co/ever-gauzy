import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { TenantSettingService } from '../../tenant/tenant-setting/tenant-setting.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class TenantSettingsMiddleware implements NestMiddleware {
	private logging = true;

	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly tenantSettingService: TenantSettingService
	) { }

	/**
	 *
	 * @param _request
	 * @param _response
	 * @param next
	 */
	async use(_request: Request, _response: Response, next: NextFunction) {
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

					const cacheKey = 'tenantSettings_' + decodedToken.tenantId;

					tenantSettings = await this.cacheManager.get(cacheKey);

					if (!tenantSettings) {
						if (this.logging) {
							console.log('Tenant settings NOT loaded from Cache for tenantId: %s', decodedToken.tenantId);
						}

						// Fetch tenant settings based on the decoded tenantId
						tenantSettings = await this.tenantSettingService.get({
							where: {
								tenantId: decodedToken.tenantId
							}
						});

						if (tenantSettings) {
							const ttl = 5 * 60 * 1000 // 5 min caching period for Tenants Settings
							await this.cacheManager.set(cacheKey, tenantSettings, ttl);

							if (this.logging) {
								console.log('Tenant settings loaded from DB and stored in Cache for tenantId: %s', decodedToken.tenantId);
							}
						}
					} else {
						if (this.logging) {
							console.log('Tenant settings loaded from Cache for tenantId: %s', decodedToken.tenantId);
						}
					}
				}

				if (tenantSettings) {
					// Attach tenantSettings to the request object
					_request['tenantSettings'] = tenantSettings;
				}
			}
		} catch (error) {
			console.log('Error while getting Tenant settings: %s', error?.message);
			console.log(_request.path, _request.url);
		}

		next();
	}
}
