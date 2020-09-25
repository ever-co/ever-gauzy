import {
	NestModule,
	MiddlewareConsumer,
	Injectable,
	NestMiddleware,
	NestInterceptor,
	ExecutionContext,
	CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as _ from 'underscore';
import { TenantSettingService } from '../../tenant/tenant-setting/tenant-setting.service';
import { RequestContext } from '../context';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class FileStorageMiddleware implements NestMiddleware {
	constructor(private tenantSettingService: TenantSettingService) {}

	async use(req, res, next) {
		const authHeader = req.headers.authorization;
		const token = authHeader.split(' ')[1];
		const data: any = jwt.decode(token);

		console.log({ data, token });

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
