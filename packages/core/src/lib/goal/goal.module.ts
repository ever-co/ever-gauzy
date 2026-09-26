import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalController } from './goal.controller';
import { Goal } from './goal.entity';
import { GoalResolver } from './goal.resolver';
import { GoalService } from './goal.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalRepository } from './repository/type-orm-goal.repository';
import { MikroOrmGoalRepository } from './repository/mikro-orm-goal.repository';

/**
 * The objective, and the key results the sibling aggregate files under it.
 *
 * The resolver is declared here rather than by the module that hosts the resolver graph, for the
 * reason every other domain states: a resolver can only inject services its own module can reach, and
 * this module is what reaches `GoalService`. `GoalService` is exported beside it so that a module
 * which *does* host the resolver graph can import this one and receive the service the resolver calls
 * — a module's imports are not inherited, and exporting the service from the module that happens to
 * own it is not enough; the module has to hand it on.
 *
 * `RolePermissionModule` is imported for the guards rather than for a resolver: a guard is a provider
 * of whichever module hosts the handler it protects, so the tenant guard every route here carries
 * resolves its permission lookup from this module.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Goal]), MikroOrmModule.forFeature([Goal]), RolePermissionModule],
	controllers: [GoalController],
	providers: [
		GoalService,
		// The GraphQL view of the same resource.
		GoalResolver,
		TypeOrmGoalRepository,
		MikroOrmGoalRepository
	],
	exports: [GoalService]
})
export class GoalModule {}