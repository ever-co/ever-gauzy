import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TimeOffPolicyService } from './time-off-policy.service';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TimeOffPolicyController } from './time-off-policy.controller';
import { EmployeeModule } from './../employee/employee.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([
			{ path: 'time-off-policy', module: TimeOffPolicyModule }
		]),
		TypeOrmModule.forFeature([TimeOffPolicy]),
		MikroOrmModule.forFeature([TimeOffPolicy]),
		RolePermissionModule,
		EmployeeModule,
		TaskModule
	],
	controllers: [TimeOffPolicyController],
	providers: [TimeOffPolicyService],
	exports: [TypeOrmModule, MikroOrmModule, TimeOffPolicyService]
})
export class TimeOffPolicyModule { }
