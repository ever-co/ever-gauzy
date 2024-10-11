import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { ApiCallLog } from './api-call-log.entity';
import { MikroOrmApiCallLogRepository } from './repository/mikro-orm-api-call-log.repository';
import { TypeOrmApiCallLogRepository } from './repository/type-orm-api-call-log.repository';

@Injectable()
export class ApiCallLogService extends TenantAwareCrudService<ApiCallLog> {
	constructor(
		readonly typeOrmApiCallLogRepository: TypeOrmApiCallLogRepository,
		readonly mikroOrmApiCallLogRepository: MikroOrmApiCallLogRepository
	) {
		super(typeOrmApiCallLogRepository, mikroOrmApiCallLogRepository);
	}
}
