import { Injectable, NestMiddleware } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { TenantSettingService } from '../../tenant/tenant-setting/tenant-setting.service';

@Injectable()
export class FileStorageMiddleware implements NestMiddleware {

	constructor(
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
					// Fetch tenant settings based on the decoded tenantId
					tenantSettings = await this.tenantSettingService.get({
						where: {
							tenantId: decodedToken.tenantId
						}
					});
				}

				// Attach tenantSettings to the request object
				_request['tenantSettings'] = tenantSettings;
			}
		} catch (error) {
			console.log('Error while getting Tenant settings: %s', error?.message);
			console.log(_request.path, _request.url);
		}

		next();
	}
}
