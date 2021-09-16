import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthService } from '../auth/auth.service';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { SharedModule } from '../shared';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { RoleModule } from './../role/role.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { OrganizationContactModule } from './../organization-contact/organization-contact.module';
import { OrganizationDepartmentModule } from './../organization-department/organization-department.module';
import { OrganizationModule } from './../organization/organization.module';
import { UserOrganizationModule } from './../user-organization/user-organization.module';
import { InviteController } from './invite.controller';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/invite', module: InviteModule }
		]),
		TypeOrmModule.forFeature([ Invite ]),
		SharedModule,
		CqrsModule,
		EmailModule,
		TenantModule,
		UserModule,
		RoleModule,
		EmployeeModule,
		OrganizationModule,
		OrganizationProjectModule,
		OrganizationContactModule,
		OrganizationDepartmentModule,
		UserOrganizationModule
	],
	controllers: [InviteController],
	providers: [
		InviteService,
		...CommandHandlers,
		AuthService,
		EmailService,
	],
	exports: [
		TypeOrmModule,
		InviteService
	]
})
export class InviteModule {}
