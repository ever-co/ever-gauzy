import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EmailModule } from './../email/email.module';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationTeamModule } from './../organization-team/organization-team.module';
import { CommandHandlers } from './commands/handlers';
import { OrganizationTeamJoinRequestController } from './organization-team-join-request.controller';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-team-join', module: OrganizationTeamJoinRequestModule }
		]),
		TypeOrmModule.forFeature([
			OrganizationTeamJoinRequest
		]),
		CqrsModule,
		TenantModule,
		OrganizationTeamModule,
		EmailModule
	],
	controllers: [
		OrganizationTeamJoinRequestController
	],
	providers: [
		OrganizationTeamJoinRequestService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		OrganizationTeamJoinRequestService
	]
})
export class OrganizationTeamJoinRequestModule { }
