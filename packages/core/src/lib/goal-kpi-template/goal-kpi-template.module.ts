import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateResolver } from './goal-kpi-template.resolver';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalKPITemplateRepository } from './repository/type-orm-goal-kpi-template.repository';
import { MikroOrmGoalKPITemplateRepository } from './repository/mikro-orm-goal-kpi-template.repository';

/**
 * The catalogue a measure is authored from.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `GoalKpiTemplateService`; the service is exported beside it so a
 * module that hosts the resolver graph can import this one and receive what the resolver calls.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([GoalKPITemplate]),
		MikroOrmModule.forFeature([GoalKPITemplate]),
		RolePermissionModule
	],
	controllers: [GoalKpiTemplateController],
	providers: [
		GoalKpiTemplateService,
		// The GraphQL view of the same resource.
		GoalKpiTemplateResolver,
		TypeOrmGoalKPITemplateRepository,
		MikroOrmGoalKPITemplateRepository
	],
	exports: [GoalKpiTemplateService]
})
export class GoalKpiTemplateModule {}