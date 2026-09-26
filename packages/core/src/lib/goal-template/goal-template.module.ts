import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalTemplateController } from './goal-template.controller';
import { GoalTemplateResolver } from './goal-template.resolver';
import { GoalTemplateService } from './goal-template.service';
import { GoalTemplate } from './goal-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalTemplateRepository } from './repository/type-orm-goal-template.repository';
import { MikroOrmGoalTemplateRepository } from './repository/mikro-orm-goal-template.repository';

/**
 * The catalogue an objective is authored from.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `GoalTemplateService`; the service is exported beside it so a module
 * that hosts the resolver graph can import this one and receive what the resolver calls.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([GoalTemplate]),
		MikroOrmModule.forFeature([GoalTemplate]),
		RolePermissionModule
	],
	controllers: [GoalTemplateController],
	providers: [
		GoalTemplateService,
		// The GraphQL view of the same resource.
		GoalTemplateResolver,
		TypeOrmGoalTemplateRepository,
		MikroOrmGoalTemplateRepository
	],
	exports: [GoalTemplateService]
})
export class GoalTemplateModule {}