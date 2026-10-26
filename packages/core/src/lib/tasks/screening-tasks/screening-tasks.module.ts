import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskModule } from '../task.module';
import { OrganizationProjectModule } from '../../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { ScreeningTasksService } from './screening-tasks.service';
import { ScreeningTasksController } from './screening-tasks.controller';
import { ScreeningTask } from './screening-task.entity';
import { TypeOrmScreeningTaskRepository } from './repository/type-orm-screening-task.repository';
import { MikroOrmScreeningTaskRepository } from './repository/mikro-orm-screening-task.repository';
import { ScreeningTaskResolver } from './screening-task.resolver';

/**
 * The decision a task goes through before it becomes work.
 *
 * `CqrsModule` is imported because the resolver is a provider of this module: the two commands its
 * writes dispatch through — the ones that file the task, subscribe the assignees and write the
 * activity logs — have to be reachable here, not only by the controller beside it.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ScreeningTask]),
		MikroOrmModule.forFeature([ScreeningTask]),
		OrganizationProjectModule,
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	providers: [
		ScreeningTasksService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ScreeningTaskResolver,
		TypeOrmScreeningTaskRepository,
		MikroOrmScreeningTaskRepository,
		...CommandHandlers
	],
	controllers: [ScreeningTasksController],
	// Both the service and the bus are handed on: a resolver is a provider of whichever module hosts
	// the handler the Apollo configuration names, and a module's imports are not inherited, so the
	// host reaches them only if this module exports them.
	exports: [ScreeningTasksService, CqrsModule]
})
export class ScreeningTasksModule {}