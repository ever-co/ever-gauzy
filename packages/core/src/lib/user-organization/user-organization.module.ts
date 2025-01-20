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
import { UserOrganization } from './user-organization.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmUserOrganizationRepository } from './repository/type-orm-user-organization.repository';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([UserOrganization])),
		forwardRef(() => MikroOrmModule.forFeature([UserOrganization])),
		forwardRef(() => TenantModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => UserModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => RoleModule),
		CqrsModule
	],
	controllers: [UserOrganizationController],
	providers: [
		UserOrganizationService,
		TypeOrmUserOrganizationRepository,
		MikroOrmUserOrganizationRepository,
		...CommandHandlers
	],
	exports: [UserOrganizationService, TypeOrmUserOrganizationRepository, MikroOrmUserOrganizationRepository]
})
export class UserOrganizationModule {}
