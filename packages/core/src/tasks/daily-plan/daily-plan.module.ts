import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPlanService } from './daily-plan.service';
import { DailyPlanController } from './daily-plan.controller';
import { RolePermissionModule } from 'role-permission';
import { DailyPlan } from './daily-plan.entity';
import { EmployeeModule } from '../../employee/employee.module';
import { TaskModule } from '../task.module';
import { TypeOrmDailyPlanRepository } from './repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([DailyPlan]),
		MikroOrmModule.forFeature([DailyPlan]),
		RouterModule.register([{ path: '/daily-plan', module: DailyPlanModule }]),
		RolePermissionModule,
		EmployeeModule,
		TaskModule,
		CqrsModule
	],
	providers: [DailyPlanService, TypeOrmDailyPlanRepository],
	controllers: [DailyPlanController]
})
export class DailyPlanModule {}
