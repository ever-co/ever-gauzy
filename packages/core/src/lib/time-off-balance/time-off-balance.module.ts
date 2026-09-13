import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Employee } from './../employee/employee.entity';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { TimeOffPolicy } from './../time-off-policy/time-off-policy.entity';
import { TimeOffBalance } from './time-off-balance.entity';
import { TimeOffBalanceController } from './time-off-balance.controller';
import { TimeOffBalanceService } from './time-off-balance.service';
import { MikroOrmTimeOffBalanceRepository } from './repository/mikro-orm-time-off-balance.repository';
import { TypeOrmTimeOffBalanceRepository } from './repository/type-orm-time-off-balance.repository';

/**
 * `Employee` and `TimeOffPolicy` are registered with `forFeature` here so the service can verify
 * that an allocation targets an employee and a policy of the caller's own organization, without
 * importing their modules and risking a cycle.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TimeOffBalance, Employee, TimeOffPolicy]),
		MikroOrmModule.forFeature([TimeOffBalance]),
		RolePermissionModule
	],
	controllers: [TimeOffBalanceController],
	providers: [TimeOffBalanceService, TypeOrmTimeOffBalanceRepository, MikroOrmTimeOffBalanceRepository],
	exports: [TimeOffBalanceService, TypeOrmTimeOffBalanceRepository, MikroOrmTimeOffBalanceRepository]
})
export class TimeOffBalanceModule {}
