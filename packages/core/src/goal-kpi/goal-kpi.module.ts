import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalKpiController } from './goal-kpi.controller';
import { GoalKpiService } from './goal-kpi.service';
import { GoalKPI } from './goal-kpi.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-kpi', module: GoalKpiModule }]),
		TypeOrmModule.forFeature([GoalKPI]),
		MikroOrmModule.forFeature([GoalKPI]),
		RolePermissionModule
	],
	controllers: [GoalKpiController],
	providers: [GoalKpiService],
	exports: [GoalKpiService]
})
export class GoalKpiModule { }
