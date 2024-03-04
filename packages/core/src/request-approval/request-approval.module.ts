import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalController } from './request-approval.controller';
import { RequestApprovalService } from './request-approval.service';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationTeamService } from '../organization-team/organization-team.service';
import { EmployeeService } from '../employee/employee.service';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { OrganizationModule } from './../organization/organization.module';
import { EquipmentSharingModule } from './../equipment-sharing/equipment-sharing.module';
import { TimeOffRequestModule } from './../time-off-request/time-off-request.module';
import { CommandHandlers } from './commands/handlers';
import { TaskModule } from './../tasks/task.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/request-approval', module: RequestApprovalModule }]),
		TypeOrmModule.forFeature([RequestApproval, Employee, OrganizationTeam]),
		MikroOrmModule.forFeature([RequestApproval, Employee, OrganizationTeam]),
		CqrsModule,
		OrganizationTeamEmployeeModule,
		TenantModule,
		RolePermissionModule,
		UserModule,
		RoleModule,
		OrganizationModule,
		EquipmentSharingModule,
		TimeOffRequestModule,
		TaskModule
	],
	controllers: [RequestApprovalController],
	providers: [RequestApprovalService, OrganizationTeamService, EmployeeService, ...CommandHandlers],
	exports: [RequestApprovalService]
})
export class RequestApprovalModule { }
