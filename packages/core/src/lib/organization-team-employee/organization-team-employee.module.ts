import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationTeamEmployeeController } from './organization-team-employee.controller';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { OrganizationTeamEmployeeResolver } from './organization-team-employee.resolver';
import { TaskModule } from './../tasks/task.module';
import { TypeOrmOrganizationTeamEmployeeRepository } from './repository/type-orm-organization-team-employee.repository';
import { MikroOrmOrganizationTeamEmployeeRepository } from './repository/mikro-orm-organization-team-employee.repository';

/**
 * The membership rows of an organization team.
 *
 * The GraphQL view of the same three writes is declared here, beside the service it calls, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach. Its
 * one dependency is `OrganizationTeamEmployeeService`, which this module already exports for its own
 * importers.
 *
 * `CqrsModule` is re-exported rather than merely imported: this module imports it for the event bus
 * the service injects, and a module's imports are not inherited by the module that imports it, so a
 * host that needs that bus through this domain receives it only because this module hands it on.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTeamEmployee]),
		MikroOrmModule.forFeature([OrganizationTeamEmployee]),
		RolePermissionModule,
		CqrsModule,
		TaskModule
	],
	controllers: [OrganizationTeamEmployeeController],
	providers: [
		OrganizationTeamEmployeeService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		OrganizationTeamEmployeeResolver,
		TypeOrmOrganizationTeamEmployeeRepository,
		MikroOrmOrganizationTeamEmployeeRepository
	],
	exports: [
		OrganizationTeamEmployeeService,
		CqrsModule,
		TypeOrmOrganizationTeamEmployeeRepository,
		MikroOrmOrganizationTeamEmployeeRepository
	]
})
export class OrganizationTeamEmployeeModule {}
