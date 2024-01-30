import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganization } from './user-organization.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationModule } from './../organization/organization.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/user-organization', module: UserOrganizationModule }]),
		forwardRef(() => TypeOrmModule.forFeature([UserOrganization])),
		forwardRef(() => MikroOrmModule.forFeature([UserOrganization])),
		CqrsModule,
		TenantModule,
		forwardRef(() => OrganizationModule),
		forwardRef(() => UserModule),
		forwardRef(() => RoleModule)
	],
	controllers: [UserOrganizationController],
	providers: [UserOrganizationService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, UserOrganizationService]
})
export class UserOrganizationModule { }
