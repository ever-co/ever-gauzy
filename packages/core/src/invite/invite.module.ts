import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthService } from '../auth/auth.service';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationDepartmentService } from '../organization-department/organization-department.service';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { SharedModule } from '../shared';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { CommandHandlers } from './commands/handlers';
import { InviteController } from './invite.controller';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
import { TenantService } from '../tenant/tenant.service';
import { Tenant } from '../tenant/tenant.entity';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/invite', module: InviteModule }]),
		TypeOrmModule.forFeature([
			Role,
			Invite,
			Employee,
			User,
			UserOrganization,
			OrganizationProject,
			OrganizationContact,
			OrganizationDepartment,
			Organization,
			Tenant,
			RolePermissions
		]),
		SharedModule,
		CqrsModule,
		EmailModule,
		TenantModule
	],
	controllers: [InviteController],
	providers: [
		InviteService,
		...CommandHandlers,
		EmployeeService,
		RoleService,
		UserService,
		AuthService,
		UserOrganizationService,
		EmailService,
		OrganizationProjectsService,
		OrganizationContactService,
		OrganizationDepartmentService,
		OrganizationService,
		TenantService,
		RolePermissionsService
	],
	exports: [InviteService]
})
export class InviteModule {}
