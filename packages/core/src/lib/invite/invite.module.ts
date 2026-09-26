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
import { InviteResolver } from './invite.resolver';
import { InviteService } from './invite.service';
import { EmailSendModule } from './../email-send/email-send.module';
import { TypeOrmInviteRepository } from './repository/type-orm-invite.repository';
import { MikroOrmInviteRepository } from './repository/mikro-orm-invite.repository';

/**
 * The invitation: the row between a tenant and a person who is not in it yet, the credential the
 * platform mails to that person, and the answer they give it.
 *
 * **The GraphQL view of the same resource is declared here, beside the service and the two buses its
 * fields dispatch through**, because a resolver is an ordinary Nest provider and can only inject what
 * the module hosting it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The REST controller beside the resolver
 * resolves its command bus and its query bus from this module's own imports, so nothing had to be
 * handed on until the GraphQL view of the same resource existed. The resolver is a provider of
 * whichever module the Apollo configuration scans, and a module's imports are not inherited by the
 * module that imports it — so both buses travel with the export, because this surface uses both: the
 * send, the resend, the two acceptances and the refusal are commands, and the two presentations of a
 * mailed credential are queries.
 *
 * Both additions are wiring and nothing else: no route, entity, service or DTO changed.
 */
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
	providers: [
		InviteService,
		// The GraphQL view of the same resource.
		InviteResolver,
		TypeOrmInviteRepository,
		MikroOrmInviteRepository,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [InviteService, TypeOrmInviteRepository, MikroOrmInviteRepository, CqrsModule]
})
export class InviteModule {}