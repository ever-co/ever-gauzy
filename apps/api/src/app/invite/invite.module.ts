import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../auth';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { Employee, EmployeeService } from '../employee';
import {
	OrganizationClients,
	OrganizationClientsService
} from '../organization-clients';
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

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Invite,
			Employee,
			User,
			UserOrganization,
			OrganizationProjects,
			OrganizationClients,
			OrganizationDepartment
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
		UserService,
		AuthService,
		UserOrganizationService,
		EmailService,
		OrganizationProjectsService,
		OrganizationClientsService,
		OrganizationDepartmentService
	],
	exports: [InviteService]
})
export class InviteModule {}
