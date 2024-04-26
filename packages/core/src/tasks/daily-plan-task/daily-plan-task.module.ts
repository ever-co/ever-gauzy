import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { DailyPlanTaskService } from './daily-plan-task.service';
import { DailyPlanTaskController } from './daily-plan-task.controller';
import { RolePermissionModule } from 'role-permission';

@Module({
	imports: [
		RouterModule.register([{ path: '/daily-plan-task', module: DailyPlanTaskModule }]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [DailyPlanTaskController],
	providers: [DailyPlanTaskService],
	exports: [DailyPlanTaskService]
})
export class DailyPlanTaskModule {}
