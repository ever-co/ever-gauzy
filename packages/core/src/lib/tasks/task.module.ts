import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '../event-bus/event-bus.module';
import { IntegrationMap, TaskStatus } from '../core/entities/internal';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { OrganizationSprintModule } from './../organization-sprint/organization-sprint.module';
import { TaskViewModule } from './views/view.module';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TypeOrmTaskRepository } from './repository/type-orm-task.repository';
import { MikroOrmTaskRepository } from './repository/mikro-orm-task.repository';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';
import { TaskResolver } from './task.resolver';

/**
 * The unit of work.
 *
 * The resolver is a provider of *this* module because every service it calls — the task service and
 * the command bus the two writes dispatch through — is one this module already reaches; a resolver
 * can only inject what its own module can reach, which is why it is declared here rather than beside
 * the schema that describes it.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's command bus
 * resolvable by the module the Apollo configuration names: a resolver is a provider of whichever
 * module hosts the handler, and a module's imports are not inherited by the module that imports it, so
 * a host that imports this one receives the bus only if this module hands it on. The REST controller
 * beside it resolves the bus from this module's own imports, which is why nothing needed re-exporting
 * until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Task, TaskStatus, IntegrationMap]),
		MikroOrmModule.forFeature([Task, TaskStatus, IntegrationMap]),
		RolePermissionModule,
		forwardRef(() => UserModule),
		RoleModule,
		EmployeeModule,
		OrganizationProjectModule,
		OrganizationSprintModule,
		TaskViewModule,
		EmployeeNotificationModule,
		CqrsModule,
		EventBusModule
	],
	controllers: [TaskController],
	providers: [
		TaskService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TaskResolver,
		TypeOrmTaskRepository,
		MikroOrmTaskRepository,
		...CommandHandlers
	],
	exports: [TaskService, CqrsModule, TypeOrmTaskRepository, MikroOrmTaskRepository]
})
export class TaskModule {}