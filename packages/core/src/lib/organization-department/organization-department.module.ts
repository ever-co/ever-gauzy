import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentController } from './organization-department.controller';
import { OrganizationDepartmentResolver } from './organization-department.resolver';
import { OrganizationDepartmentService } from './organization-department.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationDepartmentRepository } from './repository/type-orm-organization-department.repository';
import { MikroOrmOrganizationDepartmentRepository } from './repository/mikro-orm-organization-department.repository';

/**
 * The unit an organization files its people and its recruiting under.
 *
 * **The resolver is declared here, beside the service and the command bus it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The REST controller beside the resolver
 * resolves the command bus from this module's own imports, so the service and the two repositories
 * were the only exports that were needed until the GraphQL view of the same resource existed. The
 * resolver is a provider of whichever module the Apollo configuration names, and a module's imports
 * are not inherited by the module that imports it, so the command bus the two write fields dispatch
 * through has to be handed on.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationDepartment]),
		MikroOrmModule.forFeature([OrganizationDepartment]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationDepartmentController],
	providers: [
		OrganizationDepartmentService,
		// The GraphQL view of the same resource.
		OrganizationDepartmentResolver,
		TypeOrmOrganizationDepartmentRepository,
		MikroOrmOrganizationDepartmentRepository,
		...CommandHandlers
	],
	exports: [
		OrganizationDepartmentService,
		TypeOrmOrganizationDepartmentRepository,
		MikroOrmOrganizationDepartmentRepository,
		CqrsModule
	]
})
export class OrganizationDepartmentModule {}