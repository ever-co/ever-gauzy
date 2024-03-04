import { CqrsModule } from '@nestjs/cqrs';
import { Module, forwardRef } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationModule } from './../organization/organization.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/user-organization', module: UserOrganizationModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([UserOrganization])),
		forwardRef(() => MikroOrmModule.forFeature([UserOrganization])),
		forwardRef(() => TenantModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => UserModule),
		forwardRef(() => RoleModule),
		CqrsModule
	],
	controllers: [UserOrganizationController],
	providers: [UserOrganizationService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, UserOrganizationService]
})
export class UserOrganizationModule { }
