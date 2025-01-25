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
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';
import { TypeOrmOrganizationTeamJoinRequestRepository } from './repository/type-orm-organization-team-join-request.repository';

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
	providers: [OrganizationTeamJoinRequestService, TypeOrmOrganizationTeamJoinRequestRepository, ...CommandHandlers],
	exports: [OrganizationTeamJoinRequestService]
})
export class OrganizationTeamJoinRequestModule {}
