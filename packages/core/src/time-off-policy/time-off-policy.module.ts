import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TimeOffPolicyService } from './time-off-policy.service';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TimeOffPolicyController } from './time-off-policy.controller';
import { EmployeeModule } from './../employee/employee.module';
import { UserModule } from './../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([{ path: 'time-off-policy', module: TimeOffPolicyModule }]),
		TypeOrmModule.forFeature([TimeOffPolicy]),
		TenantModule,
		UserModule,
		EmployeeModule,
		TaskModule
	],
	controllers: [TimeOffPolicyController],
	providers: [TimeOffPolicyService],
	exports: [TypeOrmModule, TimeOffPolicyService]
})
export class TimeOffPolicyModule {}
