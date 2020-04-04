import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../auth';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { OrganizationClientsService } from '../organization-clients/organization-clients.service';
import {
	OrganizationDepartment,
	OrganizationDepartmentService
} from '../organization-department';
import {
	OrganizationProjects,
	OrganizationProjectsService
} from '../organization-projects';
import { SharedModule } from '../shared';
import { User, UserService } from '../user';
import {
	UserOrganization,
	UserOrganizationService
} from '../user-organization';
import { CommandHandlers } from './commands/handlers';
import { InviteController } from './invite.controller';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { Role, RoleService } from '../role';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Role,
			Invite,
			Employee,
			User,
			UserOrganization,
			OrganizationProjects,
			OrganizationClients,
			OrganizationDepartment,
			Organization
		]),
		SharedModule,
		CqrsModule,
		EmailModule
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
		OrganizationClientsService,
		OrganizationDepartmentService,
		OrganizationService
	],
	exports: [InviteService]
})
export class InviteModule {}
