import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FavoriteEntityEnum } from '@gauzy/contracts';
import { FavoriteService } from '../../core/decorators';
import { TenantAwareCrudService } from '../../core/crud';
import { TaskView } from './view.entity';
import { TypeOrmTaskViewRepository } from './repository/type-orm-task-view.repository';
import { MikroOrmTaskViewRepository } from './repository/mikro-orm-task-view.repository';

@FavoriteService(FavoriteEntityEnum.OrganizationTeam)
@Injectable()
export class TaskViewService extends TenantAwareCrudService<TaskView> {
	constructor(
		@InjectRepository(TaskView)
		typeOrmTaskViewRepository: TypeOrmTaskViewRepository,

		mikroOrmTaskViewRepository: MikroOrmTaskViewRepository
	) {
		super(typeOrmTaskViewRepository, mikroOrmTaskViewRepository);
	}
}
