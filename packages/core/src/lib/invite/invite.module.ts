import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
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
import { EmailSendModule } from './../email-send/email-send.module';
import { TypeOrmInviteRepository } from './repository/type-orm-invite.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Invite]),
		MikroOrmModule.forFeature([Invite]),
		CqrsModule,
		EmailSendModule,
		TenantModule,
		RolePermissionModule,
		UserModule,
		RoleModule,
		EmployeeModule,
		CandidateModule,
		OrganizationModule,
		OrganizationProjectModule,
		OrganizationContactModule,
		OrganizationDepartmentModule,
		OrganizationTeamModule,
		OrganizationTeamEmployeeModule,
		UserOrganizationModule,
		AuthModule
	],
	controllers: [InviteController],
	providers: [InviteService, TypeOrmInviteRepository, ...CommandHandlers, ...QueryHandlers],
	exports: [InviteService, TypeOrmInviteRepository]
})
export class InviteModule {}
