import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { EmployeeModule } from '../../employee/employee.module';
import { TimeGoal } from './time-goal.entity';
import { TimeGoalController } from './time-goal.controller';
import { TimeGoalService } from './time-goal.service';
import { MikroOrmTimeGoalRepository } from './repository/mikro-orm-time-goal.repository';
import { TypeOrmTimeGoalRepository } from './repository/type-orm-time-goal.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TimeGoal]),
		MikroOrmModule.forFeature([TimeGoal]),
		RolePermissionModule,
		EmployeeModule
	],
	controllers: [TimeGoalController],
	providers: [TimeGoalService, TypeOrmTimeGoalRepository, MikroOrmTimeGoalRepository],
	exports: [TimeGoalService, TypeOrmTimeGoalRepository, MikroOrmTimeGoalRepository]
})
export class TimeGoalModule {}
