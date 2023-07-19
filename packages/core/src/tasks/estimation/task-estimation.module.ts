import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';

import { TenantModule } from './../../tenant/tenant.module';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationController } from './task-estimation.controller';
import { TaskEstimationService } from './task-estimation.service';
import { UserModule } from '../../user/user.module';
import { TaskModule } from '../task.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-estimation', module: TaskEstimationModule },
		]),
		TypeOrmModule.forFeature([TaskEstimation]),
		TenantModule,
		CqrsModule,
		UserModule,
		TaskModule,
	],
	controllers: [TaskEstimationController],
	providers: [TaskEstimationService, ...CommandHandlers],
	exports: [TaskEstimationService],
})
export class TaskEstimationModule {}
