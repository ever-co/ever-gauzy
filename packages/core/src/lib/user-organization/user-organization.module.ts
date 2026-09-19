import { CqrsModule } from '@nestjs/cqrs';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationModule } from './../organization/organization.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from './../role/role.module';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganizationResolver } from './user-organization.resolver';
import { UserOrganization } from './user-organization.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmUserOrganizationRepository } from './repository/type-orm-user-organization.repository';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';

/**
 * The membership: the pivot that puts an account inside an organization.
 *
 * **The GraphQL view of the same resource is declared here, beside the service it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach.
 * `UserOrganizationService` is already exported; `CqrsModule` is re-exported beside it, because the
 * resolver dispatches the same removal command the REST route dispatches and a command bus is resolved
 * from the module that hosts the handler — a module's imports are not inherited by the module that
 * imports it. That re-export is the whole of what the GraphQL surface added here.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([UserOrganization]),
		MikroOrmModule.forFeature([UserOrganization]),
		forwardRef(() => TenantModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => UserModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => RoleModule)
	],
	controllers: [UserOrganizationController],
	providers: [
		UserOrganizationService,
		// The GraphQL view of the same resource.
		UserOrganizationResolver,
		TypeOrmUserOrganizationRepository,
		MikroOrmUserOrganizationRepository,
		...CommandHandlers
	],
	exports: [
		UserOrganizationService,
		TypeOrmUserOrganizationRepository,
		MikroOrmUserOrganizationRepository,
		CqrsModule
	]
})
export class UserOrganizationModule {}
