import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			OrganizationTeamJoinRequest
		]),
		TenantModule
	],
	controllers: [],
	providers: [],
	exports: [TypeOrmModule]
})
export class OrganizationTeamJoinRequestModule { }
