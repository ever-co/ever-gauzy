import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalKpiController } from './goal-kpi.controller';
import { GoalKpiResolver } from './goal-kpi.resolver';
import { GoalKpiService } from './goal-kpi.service';
import { GoalKPI } from './goal-kpi.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalKPIRepository } from './repository/type-orm-goal-kpi.repository';
import { MikroOrmGoalKPIRepository } from './repository/mikro-orm-goal-kpi.repository';

/**
 * The measures a key result tracks.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `GoalKpiService`; the service is exported beside it so a module that
 * hosts the resolver graph can import this one and receive what the resolver calls.
 */
@Module({
	imports: [TypeOrmModule.forFeature([GoalKPI]), MikroOrmModule.forFeature([GoalKPI]), RolePermissionModule],
	controllers: [GoalKpiController],
	providers: [
		GoalKpiService,
		// The GraphQL view of the same resource.
		GoalKpiResolver,
		TypeOrmGoalKPIRepository,
		MikroOrmGoalKPIRepository
	],
	exports: [GoalKpiService]
})
export class GoalKpiModule {}