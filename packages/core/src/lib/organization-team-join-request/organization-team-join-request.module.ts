import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailSendModule } from './../email-send/email-send.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { InviteModule } from '../invite/invite.module';
import { OrganizationTeamEmployee } from '../core/entities/internal';
import { RoleModule } from '../role/role.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationTeamModule } from './../organization-team/organization-team.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { CommandHandlers } from './commands/handlers';
import { OrganizationTeamJoinRequestController } from './organization-team-join-request.controller';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestResolver } from './organization-team-join-request.resolver';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';
import { TypeOrmOrganizationTeamJoinRequestRepository } from './repository/type-orm-organization-team-join-request.repository';
import { MikroOrmOrganizationTeamJoinRequestRepository } from './repository/mikro-orm-organization-team-join-request.repository';

/**
 * The join request: the ask an address files against one organization team, the confirmation mailed to
 * it, and the move a manager makes on it.
 *
 * **The GraphQL view of the same resource is declared here, beside the service and the command bus it
 * calls**, because a resolver is an ordinary Nest provider and can only inject what the module hosting
 * it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The REST controller beside the resolver resolves
 * the command bus from this module's own imports, so the service was the only export that was needed
 * until the GraphQL view of the same resource existed. The resolver is a provider of whichever module
 * the Apollo configuration scans, and a module's imports are not inherited by the module that imports
 * it, so the command bus the ask dispatches through has to be handed on.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTeamJoinRequest, OrganizationTeamEmployee]),
		MikroOrmModule.forFeature([OrganizationTeamJoinRequest, OrganizationTeamEmployee]),
		CqrsModule,
		RolePermissionModule,
		UserModule,
		EmployeeModule,
		OrganizationTeamModule,
		OrganizationTeamEmployeeModule,
		EmailSendModule,
		InviteModule,
		RoleModule
	],
	controllers: [OrganizationTeamJoinRequestController],
	providers: [
		OrganizationTeamJoinRequestService,
		// The GraphQL view of the same resource.
		OrganizationTeamJoinRequestResolver,
		TypeOrmOrganizationTeamJoinRequestRepository,
		MikroOrmOrganizationTeamJoinRequestRepository,
		...CommandHandlers
	],
	exports: [OrganizationTeamJoinRequestService, CqrsModule]
})
export class OrganizationTeamJoinRequestModule {}