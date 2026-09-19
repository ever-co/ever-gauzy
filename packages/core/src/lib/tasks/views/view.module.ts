import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskView } from './view.entity';
import { CommandHandlers } from './commands/handlers';
import { TaskViewService } from './view.service';
import { TaskViewController } from './view.controller';
import { TypeOrmTaskViewRepository } from './repository/type-orm-task-view.repository';
import { MikroOrmTaskViewRepository } from './repository/mikro-orm-task-view.repository';
import { TaskViewResolver } from './view.resolver';

/**
 * The saved task filters.
 *
 * `CqrsModule` is imported, so the resolver's two writes can dispatch the same commands the
 * controller dispatches: a resolver is a provider of this module and can only inject what this
 * module reaches.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TaskView]),
		MikroOrmModule.forFeature([TaskView]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [
		TaskViewService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TaskViewResolver,
		TypeOrmTaskViewRepository,
		MikroOrmTaskViewRepository,
		...CommandHandlers
	],
	controllers: [TaskViewController],
	exports: [TaskViewService, CqrsModule, TypeOrmTaskViewRepository, MikroOrmTaskViewRepository]
})
export class TaskViewModule {}