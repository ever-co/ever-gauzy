import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalController } from './request-approval.controller';
import { RequestApprovalService } from './request-approval.service';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { OrganizationModule } from './../organization/organization.module';
import { EquipmentSharingModule } from './../equipment-sharing/equipment-sharing.module';
import { TimeOffRequestModule } from './../time-off-request/time-off-request.module';
import { CommandHandlers } from './commands/handlers';
import { TaskModule } from './../tasks/task.module';
import { StatisticModule } from '../time-tracking/statistic/statistic.module';
import { TimerModule } from '../time-tracking/timer/timer.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/request-approval', module: RequestApprovalModule }]),
		TypeOrmModule.forFeature([RequestApproval]),
		MikroOrmModule.forFeature([RequestApproval]),
		CqrsModule,
		OrganizationTeamEmployeeModule,
		RolePermissionModule,
		UserModule,
		EmployeeModule,
		OrganizationTeamModule,
		RoleModule,
		OrganizationModule,
		EquipmentSharingModule,
		TimeOffRequestModule,
		TaskModule,
		TimerModule,
		StatisticModule
	],
	controllers: [RequestApprovalController],
	providers: [RequestApprovalService, ...CommandHandlers],
	exports: [RequestApprovalService]
})
export class RequestApprovalModule {}
