import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TimeOffPolicyService } from './time-off-policy.service';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TimeOffPolicyController } from './time-off-policy.controller';
import { EmployeeModule } from './../employee/employee.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmTimeOffPolicyRepository } from './repository/type-orm-time-off-policy.repository';
import { MikroOrmTimeOffPolicyRepository } from './repository/mikro-orm-time-off-policy.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TimeOffPolicy]),
		MikroOrmModule.forFeature([TimeOffPolicy]),
		RolePermissionModule,
		EmployeeModule
	],
	controllers: [TimeOffPolicyController],
	providers: [TimeOffPolicyService, TypeOrmTimeOffPolicyRepository, MikroOrmTimeOffPolicyRepository],
	exports: [TimeOffPolicyService, TypeOrmTimeOffPolicyRepository, MikroOrmTimeOffPolicyRepository]
})
export class TimeOffPolicyModule {}