import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { SharedModule } from '../shared';
import { OrganizationProjects } from '../organization-projects';
import { Employee, EmployeeService } from '../employee';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { UserService, User } from '../user';
import { AuthService } from '../auth';
import {
	UserOrganizationService,
	UserOrganization
} from '../user-organization';
import { EmailModule } from '../email-templates/email.module';
import { EmailService } from '../email-templates/email.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Invite,
			Employee,
			User,
			UserOrganization,
			OrganizationProjects
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
		EmailService
	],
	exports: [InviteService]
})
export class InviteModule {}
