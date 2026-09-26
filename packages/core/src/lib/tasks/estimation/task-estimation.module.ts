import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationController } from './task-estimation.controller';
import { TaskEstimationService } from './task-estimation.service';
import { TaskModule } from '../task.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTaskEstimationRepository } from './repository/type-orm-estimation.repository';
import { MikroOrmTaskEstimationRepository } from './repository/mikro-orm-estimation.repository';
import { TaskEstimationResolver } from './task-estimation.resolver';

/**
 * The estimates a task carries.
 *
 * `CqrsModule` is imported, not re-exported, because the resolver is a provider of *this* module: a
 * resolver can only inject services its own module can reach, so the command bus its three writes
 * dispatch through has to be reachable here rather than only by the controller beside it.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TaskEstimation]),
		MikroOrmModule.forFeature([TaskEstimation]),
		RolePermissionModule,
		CqrsModule,
		TaskModule
	],
	controllers: [TaskEstimationController],
	providers: [
		TaskEstimationService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TaskEstimationResolver,
		TypeOrmTaskEstimationRepository,
		MikroOrmTaskEstimationRepository,
		...CommandHandlers
	],
	// The service and the bus are handed on beside the resolver, because a resolver is a provider of
	// whichever module hosts the handler the Apollo configuration names: a module's imports are not
	// inherited, so the host receives this module's bus only if this module exports it.
	exports: [TaskEstimationService, CqrsModule]
})
export class TaskEstimationModule {}