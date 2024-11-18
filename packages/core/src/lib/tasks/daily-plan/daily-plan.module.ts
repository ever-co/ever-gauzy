import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPlanService } from './daily-plan.service';
import { DailyPlanController } from './daily-plan.controller';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { DailyPlan } from './daily-plan.entity';
import { EmployeeModule } from '../../employee/employee.module';
import { TaskModule } from '../task.module';
import { TypeOrmDailyPlanRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/daily-plan', module: DailyPlanModule }]),
		TypeOrmModule.forFeature([DailyPlan]),
		MikroOrmModule.forFeature([DailyPlan]),
		RolePermissionModule,
		EmployeeModule,
		TaskModule
	],
	controllers: [DailyPlanController],
	providers: [DailyPlanService, TypeOrmDailyPlanRepository],
	exports: [TypeOrmModule, MikroOrmModule, DailyPlanService]
})
export class DailyPlanModule {}
