import { BadRequestException, Injectable } from '@nestjs/common';
import { IActivityLog, IActivityLogCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { ActivityLog } from './activity-log.entity';
import { TypeOrmActivityLogRepository } from './repository/type-orm-activity-log.repository';
import { MikroOrmActivityLogRepository } from './repository/mikro-orm-activity-log.repository';

@Injectable()
export class ActivityLogService extends TenantAwareCrudService<ActivityLog> {
	constructor(
		readonly typeOrmActivityLogRepository: TypeOrmActivityLogRepository,
		readonly mikroOrmActivityLogRepository: MikroOrmActivityLogRepository
	) {
		super(typeOrmActivityLogRepository, mikroOrmActivityLogRepository);
	}

	async create(input: IActivityLogCreateInput): Promise<IActivityLog> {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId();

			return await super.create({ ...input, tenantId, creatorId: userId });
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Save logs failed', error);
		}
	}
}
