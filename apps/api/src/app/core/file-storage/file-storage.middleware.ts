import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantSettingService } from '../../tenant/tenant-setting/tenant-setting.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class FileStorageMiddleware implements NestMiddleware {
	constructor(private tenantSettingService: TenantSettingService) {}

	async use(req, res, next) {
		const authHeader = req.headers.authorization;
		const token = authHeader.split(' ')[1];
		const data: any = jwt.decode(token);

		let tenantSettings = {};
		if (data && data.tenantId) {
			tenantSettings = await this.tenantSettingService.get({
				where: {
					tenantId: data.tenantId
				}
			});
		}

		req.tenantSettings = tenantSettings;

		next();
	}
}
