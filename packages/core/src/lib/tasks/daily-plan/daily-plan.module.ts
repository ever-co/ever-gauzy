import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPlanService } from './daily-plan.service';
import { DailyPlanController } from './daily-plan.controller';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { DailyPlan } from './daily-plan.entity';
import { EmployeeModule } from '../../employee/employee.module';
import { TaskModule } from '../task.module';
import { TypeOrmDailyPlanRepository } from './repository/type-orm-daily-plan.repository';
import { MikroOrmDailyPlanRepository } from './repository/mikro-orm-daily-plan.repository';
import { DailyPlanResolver } from './daily-plan.resolver';

/**
 * The days planned for the people who work them.
 *
 * The resolver's three membership writes and its five reads all go through `DailyPlanService`, which
 * this module already provides, so nothing else had to be reachable for the GraphQL view to exist
 * beside the routes.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([DailyPlan]),
		MikroOrmModule.forFeature([DailyPlan]),
		RolePermissionModule,
		EmployeeModule,
		TaskModule
	],
	controllers: [DailyPlanController],
	providers: [DailyPlanService, DailyPlanResolver, TypeOrmDailyPlanRepository, MikroOrmDailyPlanRepository],
	exports: [DailyPlanService]
})
export class DailyPlanModule {}