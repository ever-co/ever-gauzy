import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from './../../tenant/tenant.module';
import { TaskPriorityController } from './priority.controller';
import { TaskPriority } from './priority.entity';
import { TaskPriorityService } from './priority.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-priorities', module: TaskPriorityModule }]),
		TypeOrmModule.forFeature([TaskPriority]),
		CqrsModule,
		TenantModule
	],
	controllers: [TaskPriorityController],
	providers: [TaskPriorityService, ...CommandHandlers],
	exports: [TaskPriorityService]
})
export class TaskPriorityModule {}
