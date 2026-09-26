import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalTimeFrameController } from './goal-time-frame.controller';
import { GoalTimeFrameResolver } from './goal-time-frame.resolver';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalTimeFrameRepository } from './repository/type-orm-goal-time-frame.repository';
import { MikroOrmGoalTimeFrameRepository } from './repository/mikro-orm-goal-time-frame.repository';

/**
 * The periods an objective is set for.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `GoalTimeFrameService`; the service is exported beside it so a
 * module that hosts the resolver graph can import this one and receive what the resolver calls.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([GoalTimeFrame]),
		MikroOrmModule.forFeature([GoalTimeFrame]),
		RolePermissionModule
	],
	controllers: [GoalTimeFrameController],
	providers: [
		GoalTimeFrameService,
		// The GraphQL view of the same resource.
		GoalTimeFrameResolver,
		TypeOrmGoalTimeFrameRepository,
		MikroOrmGoalTimeFrameRepository
	],
	exports: [GoalTimeFrameService]
})
export class GoalTimeFrameModule {}