import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalKpiController } from './goal-kpi.controller';
import { GoalKpiService } from './goal-kpi.service';
import { GoalKPI } from './goal-kpi.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalKPIRepository } from './repository/type-orm-goal-kpi.repository';

@Module({
	imports: [TypeOrmModule.forFeature([GoalKPI]), MikroOrmModule.forFeature([GoalKPI]), RolePermissionModule],
	controllers: [GoalKpiController],
	providers: [GoalKpiService, TypeOrmGoalKPIRepository]
})
export class GoalKpiModule {}
