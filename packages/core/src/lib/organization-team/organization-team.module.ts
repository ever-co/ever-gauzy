import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from './../role/role.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationModule } from './../organization/organization.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { OrganizationTeamController } from './organization-team.controller';
import { OrganizationTeamResolver } from './organization-team.resolver';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamService } from './organization-team.service';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { TimerModule } from './../time-tracking/timer/timer.module';
import { StatisticModule } from './../time-tracking/statistic/statistic.module';
import { TaskModule } from './../tasks/task.module';
import { TypeOrmOrganizationTeamRepository } from './repository/type-orm-organization-team.repository';
import { MikroOrmOrganizationTeamRepository } from './repository/mikro-orm-organization-team.repository';

/**
 * The team: the working group a task, a daily plan and a tracked stretch of time are filed under.
 *
 * `CqrsModule` is re-exported, not merely imported, because the GraphQL view of the same resource
 * dispatches the create command through the command bus and the statistics read through the query bus
 * rather than writing or reading the row itself. A resolver is a provider of whichever module hosts
 * the resolver graph, so the module that hosts it reaches those buses only if the domain module hands
 * them on — which is also why the service and both repositories are exported.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTeam]),
		MikroOrmModule.forFeature([OrganizationTeam]),
		OrganizationTeamEmployeeModule,
		RolePermissionModule,
		RoleModule,
		UserModule,
		OrganizationModule,
		EmployeeModule,
		TimerModule,
		CqrsModule,
		forwardRef(() => StatisticModule),
		TaskModule
	],
	controllers: [OrganizationTeamController],
	providers: [
		OrganizationTeamService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services and buses its own module can reach, and this module is what reaches them.
		OrganizationTeamResolver,
		TypeOrmOrganizationTeamRepository,
		MikroOrmOrganizationTeamRepository,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [
		OrganizationTeamService,
		CqrsModule,
		TypeOrmOrganizationTeamRepository,
		MikroOrmOrganizationTeamRepository
	]
})
export class OrganizationTeamModule {}
