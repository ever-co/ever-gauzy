import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
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
import { TypeOrmRequestApprovalRepository } from './repository/type-orm-request-approval.repository';

@Module({
	imports: [
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
		forwardRef(() => TimeOffRequestModule),
		forwardRef(() => EquipmentSharingModule),
		TaskModule,
		TimerModule,
		StatisticModule
	],
	controllers: [RequestApprovalController],
	providers: [RequestApprovalService, TypeOrmRequestApprovalRepository, ...CommandHandlers],
	exports: [RequestApprovalService, TypeOrmRequestApprovalRepository]
})
export class RequestApprovalModule {}
