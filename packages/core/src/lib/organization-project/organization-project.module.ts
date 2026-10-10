import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectEmployee } from './organization-project-employee.entity';
import { OrganizationProjectController } from './organization-project.controller';
import { OrganizationProjectResolver } from './organization-project.resolver';
import { OrganizationProjectService } from './organization-project.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { EmployeeRecentVisitModule } from '../employee-recent-visit/employee-recent-visit.module';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';
import { MikroOrmOrganizationProjectRepository } from './repository/mikro-orm-organization-project.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from './repository/type-orm-organization-project-employee.repository';
import { MikroOrmOrganizationProjectEmployeeRepository } from './repository/mikro-orm-organization-project-employee.repository';

/**
 * The project and the pivot that assigns employees to one.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProject, OrganizationProjectEmployee]),
		MikroOrmModule.forFeature([OrganizationProject, OrganizationProjectEmployee]),
		RoleModule,
		EmployeeModule,
		RolePermissionModule,
		EmployeeRecentVisitModule,
		CqrsModule
	],
	controllers: [OrganizationProjectController],
	providers: [
		OrganizationProjectService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		OrganizationProjectResolver,
		TypeOrmOrganizationProjectRepository, MikroOrmOrganizationProjectRepository,
		TypeOrmOrganizationProjectEmployeeRepository, MikroOrmOrganizationProjectEmployeeRepository,
		...CommandHandlers
	],
	exports: [
		OrganizationProjectService,
		TypeOrmOrganizationProjectRepository, MikroOrmOrganizationProjectRepository,
		TypeOrmOrganizationProjectEmployeeRepository, MikroOrmOrganizationProjectEmployeeRepository,
		CqrsModule
	]
})
export class OrganizationProjectModule {}