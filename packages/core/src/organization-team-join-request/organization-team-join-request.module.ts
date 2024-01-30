import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { EmailSendModule } from './../email-send/email-send.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { OrganizationTeamModule } from './../organization-team/organization-team.module';
import { CommandHandlers } from './commands/handlers';
import { OrganizationTeamJoinRequestController } from './organization-team-join-request.controller';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';
import { InviteModule } from 'invite/invite.module';
import { OrganizationTeamEmployee } from 'core';
import { RoleModule } from 'role/role.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-team-join',
				module: OrganizationTeamJoinRequestModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationTeamJoinRequest, OrganizationTeamEmployee]),
		MikroOrmModule.forFeature([OrganizationTeamJoinRequest, OrganizationTeamEmployee]),
		CqrsModule,
		TenantModule,
		UserModule,
		OrganizationTeamModule,
		EmailSendModule,
		InviteModule,
		RoleModule
	],
	controllers: [OrganizationTeamJoinRequestController],
	providers: [OrganizationTeamJoinRequestService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, OrganizationTeamJoinRequestService]
})
export class OrganizationTeamJoinRequestModule { }
