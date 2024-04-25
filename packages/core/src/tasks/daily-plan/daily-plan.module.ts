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
import { Employee } from '../../core/entities/internal';

@Module({
	imports: [
		TypeOrmModule.forFeature([DailyPlan, Employee]),
		MikroOrmModule.forFeature([DailyPlan, Employee]),
		RouterModule.register([{ path: '/daily-plan', module: DailyPlanModule }]),
		RolePermissionModule,
		EmployeeModule,
		CqrsModule
	],
	providers: [DailyPlanService],
	controllers: [DailyPlanController]
})
export class DailyPlanModule {}
