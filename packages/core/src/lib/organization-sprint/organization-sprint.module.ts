import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationSprintEmployee } from './organization-sprint-employee.entity';
import { OrganizationSprintTaskHistory } from './organization-sprint-task-history.entity';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprintResolver } from './organization-sprint.resolver';
import { OrganizationSprint } from './organization-sprint.entity';
import { Task } from '../tasks/task.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationSprintRepository } from './repository/type-orm-organization-sprint.repository';
import { MikroOrmOrganizationSprintRepository } from './repository/mikro-orm-organization-sprint.repository';
import { TypeOrmOrganizationSprintEmployeeRepository } from './repository/type-orm-organization-sprint-employee.repository';
import { MikroOrmOrganizationSprintEmployeeRepository } from './repository/mikro-orm-organization-sprint-employee.repository';
import { TypeOrmOrganizationSprintTaskHistoryRepository } from './repository/type-orm-organization-sprint-task-history.repository';
import { MikroOrmOrganizationSprintTaskHistoryRepository } from './repository/mikro-orm-organization-sprint-task-history.repository';

/**
 * The sprint: one window of work inside a project, with the people who work it filed beside it.
 *
 * `CqrsModule` is re-exported, not merely imported, because the GraphQL view of the same resource
 * dispatches the create and the edit command rather than writing the row itself. A resolver is a
 * provider of whichever module hosts the resolver graph, so the module that hosts it reaches the
 * command bus only if the domain module hands it on — which is also why the service and every
 * repository below are exported.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationSprint, Task, OrganizationSprintEmployee, OrganizationSprintTaskHistory]),
		MikroOrmModule.forFeature([
			OrganizationSprint,
			Task,
			OrganizationSprintEmployee,
			OrganizationSprintTaskHistory
		]),
		RoleModule,
		EmployeeModule,
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationSprintController],
	providers: [
		OrganizationSprintService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		OrganizationSprintResolver,
		TypeOrmOrganizationSprintRepository, MikroOrmOrganizationSprintRepository,
		TypeOrmOrganizationSprintEmployeeRepository, MikroOrmOrganizationSprintEmployeeRepository,
		TypeOrmOrganizationSprintTaskHistoryRepository, MikroOrmOrganizationSprintTaskHistoryRepository,
		...CommandHandlers
	],
	exports: [
		OrganizationSprintService,
		CqrsModule,
		TypeOrmOrganizationSprintRepository, MikroOrmOrganizationSprintRepository,
		TypeOrmOrganizationSprintEmployeeRepository, MikroOrmOrganizationSprintEmployeeRepository,
		TypeOrmOrganizationSprintTaskHistoryRepository, MikroOrmOrganizationSprintTaskHistoryRepository
	]
})
export class OrganizationSprintModule {}