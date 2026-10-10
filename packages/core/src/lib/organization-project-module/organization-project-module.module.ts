import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { OrganizationProjectModuleService } from './organization-project-module.service';
import { OrganizationProjectModuleController } from './organization-project-module.controller';
import { OrganizationProjectModuleResolver } from './organization-project-module.resolver';
import { OrganizationProjectModule } from './organization-project-module.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from '../role/role.module';
import { EmployeeModule } from '../employee/employee.module';
import { TaskModule } from '../tasks/task.module';
import { OrganizationProjectModuleEmployee } from './organization-project-module-employee.entity';
import { TypeOrmOrganizationProjectModuleRepository } from './repository/type-orm-organization-project-module.repository';
import { MikroOrmOrganizationProjectModuleRepository } from './repository/mikro-orm-organization-project-module.repository';
import { TypeOrmOrganizationProjectModuleEmployeeRepository } from './repository/type-orm-organization-project-module-employee.repository';
import { MikroOrmOrganizationProjectModuleEmployeeRepository } from './repository/mikro-orm-organization-project-module-employee.repository';

/**
 * The project module: the named, dated part of a project that employees are assigned to and teams share.
 *
 * **The resolver is declared here, beside the service and the command bus it calls**, because a resolver
 * is an ordinary Nest provider and can only inject what the module hosting it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The REST controller beside the resolver resolves
 * the command bus from this module's own imports, so nothing needed re-exporting until the GraphQL view
 * of the same resource existed. The resolver is a provider of whichever module the Apollo configuration
 * names, and a module's imports are not inherited by the module that imports it, so the command bus the
 * two write fields dispatch through has to be handed on — which is why the service and both repositories
 * are exported beside it.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProjectModule, OrganizationProjectModuleEmployee]),
		MikroOrmModule.forFeature([OrganizationProjectModule, OrganizationProjectModuleEmployee]),
		MikroOrmModule,
		RolePermissionModule,
		RoleModule,
		EmployeeModule,
		TaskModule,
		CqrsModule
	],
	controllers: [OrganizationProjectModuleController],
	providers: [
		OrganizationProjectModuleService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		OrganizationProjectModuleResolver,
		TypeOrmOrganizationProjectModuleRepository, MikroOrmOrganizationProjectModuleRepository,
		TypeOrmOrganizationProjectModuleEmployeeRepository, MikroOrmOrganizationProjectModuleEmployeeRepository,
		...CommandHandlers
	],
	exports: [
		OrganizationProjectModuleService,
		CqrsModule,
		TypeOrmOrganizationProjectModuleRepository, MikroOrmOrganizationProjectModuleRepository,
		TypeOrmOrganizationProjectModuleEmployeeRepository, MikroOrmOrganizationProjectModuleEmployeeRepository
	]
})
export class OrganizationProjectModuleModule {}
