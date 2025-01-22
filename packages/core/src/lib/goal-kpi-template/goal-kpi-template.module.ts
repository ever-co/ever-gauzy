import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalKPITemplateRepository } from './repository/type-orm-goal-kpi-template.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([GoalKPITemplate]),
		MikroOrmModule.forFeature([GoalKPITemplate]),
		RolePermissionModule
	],
	controllers: [GoalKpiTemplateController],
	providers: [GoalKpiTemplateService, TypeOrmGoalKPITemplateRepository]
})
export class GoalKpiTemplateModule {}
