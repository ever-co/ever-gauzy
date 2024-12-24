import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-kpi-template', module: GoalKpiTemplateModule }]),
		TypeOrmModule.forFeature([GoalKPITemplate]),
		MikroOrmModule.forFeature([GoalKPITemplate]),
		RolePermissionModule
	],
	controllers: [GoalKpiTemplateController],
	providers: [GoalKpiTemplateService],
	exports: [GoalKpiTemplateService]
})
export class GoalKpiTemplateModule { }
