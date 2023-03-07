import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationTeamModule } from './../organization-team/organization-team.module';
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
		TenantModule,
		OrganizationTeamModule
	],
	controllers: [
		OrganizationTeamJoinRequestController
	],
	providers: [
		OrganizationTeamJoinRequestService
	],
	exports: [
		TypeOrmModule,
		OrganizationTeamJoinRequestService
	]
})
export class OrganizationTeamJoinRequestModule { }
