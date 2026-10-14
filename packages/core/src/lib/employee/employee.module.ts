import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserModule } from './../user/user.module';
import { AuthModule } from './../auth/auth.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { EmployeeResolver } from './employee.resolver';
import { EmployeeService } from './employee.service';
import { ManagedEmployeeService } from './managed-employee.service';
import { Employee } from './employee.entity';
import { TypeOrmEmployeeRepository } from './repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from './repository/mikro-orm-employee.repository';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { OrganizationProjectEmployee } from '../organization-project/organization-project-employee.entity';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { MikroOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/mikro-orm-organization-team-employee.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from '../organization-project/repository/type-orm-organization-project-employee.repository';
import { MikroOrmOrganizationProjectEmployeeRepository } from '../organization-project/repository/mikro-orm-organization-project-employee.repository';

/**
 * The employee: the engagement one organization has of one person, and the account it belongs to.
 *
 * **The GraphQL view of the same resource is declared here, beside the service it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach.
 * `EmployeeService` is already a provider and already exported, so the resolver's first dependency
 * needed nothing new; the command bus it dispatches five of its writes through did, and it is
 * re-exported rather than merely imported: a module's imports are not inherited by the module that
 * imports it, so the module that hosts the resolver has to reach the bus itself.
 *
 * The addition is an export and nothing else: no provider, route or dependency changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Employee, OrganizationTeamEmployee, OrganizationProjectEmployee]),
		MikroOrmModule.forFeature([Employee, OrganizationTeamEmployee, OrganizationProjectEmployee]),
		forwardRef(() => EmailSendModule),
		forwardRef(() => UserOrganizationModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		forwardRef(() => AuthModule),
		RoleModule,
		CqrsModule
	],
	controllers: [EmployeeController],
	providers: [
		EmployeeService,
		ManagedEmployeeService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmployeeResolver,
		TypeOrmEmployeeRepository,
		MikroOrmEmployeeRepository,
		TypeOrmOrganizationTeamEmployeeRepository, MikroOrmOrganizationTeamEmployeeRepository,
		TypeOrmOrganizationProjectEmployeeRepository, MikroOrmOrganizationProjectEmployeeRepository,
		...CommandHandlers
	],
	exports: [
		EmployeeService,
		ManagedEmployeeService,
		CqrsModule,
		TypeOrmEmployeeRepository,
		MikroOrmEmployeeRepository,
		TypeOrmOrganizationTeamEmployeeRepository, MikroOrmOrganizationTeamEmployeeRepository,
		TypeOrmOrganizationProjectEmployeeRepository, MikroOrmOrganizationProjectEmployeeRepository
	]
})
export class EmployeeModule {}