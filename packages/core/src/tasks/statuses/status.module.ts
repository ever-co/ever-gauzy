import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../../tenant/tenant.module';
import { TaskStatus } from './status.entity';
import { TaskStatusController } from './status.controller';
import { TaskStatusService } from './status.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-statuses', module: TaskStatusModule }
		]),
		TypeOrmModule.forFeature([ TaskStatus ]),
		TenantModule,
		CqrsModule,
	],
	controllers: [TaskStatusController],
	providers: [TaskStatusService, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskStatusService],
})
export class TaskStatusModule {}
