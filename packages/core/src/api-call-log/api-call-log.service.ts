import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { ApiCallLog } from './api-call-log.entity';
import { MikroOrmApiCallLogRepository, TypeOrmApiCallLogRepository } from './repository';

@Injectable()
export class ApiCallLogService extends TenantAwareCrudService<ApiCallLog> {
	constructor(
		readonly typeOrmActivityLogRepository: TypeOrmApiCallLogRepository,
		readonly mikroOrmActivityLogRepository: MikroOrmApiCallLogRepository
	) {
		super(typeOrmActivityLogRepository, mikroOrmActivityLogRepository);
	}
}
