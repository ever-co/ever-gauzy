import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { RoleModule } from './../role/role.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { CandidateModule } from './../candidate/candidate.module';
import { OrganizationModule } from './../organization/organization.module';
import { OrganizationTeamModule } from './../organization-team/organization-team.module';
import { OrganizationTeamEmployeeModule } from './../organization-team-employee/organization-team-employee.module';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { OrganizationContactModule } from './../organization-contact/organization-contact.module';
import { OrganizationDepartmentModule } from './../organization-department/organization-department.module';
import { UserOrganizationModule } from './../user-organization/user-organization.module';
import { InviteController } from './invite.controller';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/invite', module: InviteModule }
		]),
		TypeOrmModule.forFeature([
			Invite
		]),
		CqrsModule,
		EmailModule,
		TenantModule,
		UserModule,
		RoleModule,
		EmployeeModule,
		CandidateModule,
		OrganizationModule,
		OrganizationProjectModule,
		OrganizationContactModule,
		OrganizationDepartmentModule,
		OrganizationTeamModule,
		UserOrganizationModule,
		AuthModule,
		OrganizationTeamEmployeeModule
	],
	controllers: [InviteController],
	providers: [
		InviteService,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [
		TypeOrmModule,
		InviteService
	]
})
export class InviteModule { }
