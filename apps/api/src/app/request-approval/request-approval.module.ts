import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalControler } from './request-approval.controller';
import { RequestApprovalService } from './request-approval.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationTeamService } from '../organization-team/organization-team.service';
import { Role } from '../role/role.entity';
import { Organization } from '../organization/organization.entity';
import { EmployeeService } from '../employee/employee.service';
import { RoleService } from '../role/role.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { TimeOffRequest } from '../time-off-request/time-off-request.entity';
import {
	EquipmentSharing,
	EquipmentSharingService
} from '../equipment-sharing';
import { RequestApprovalStatusHandler } from './commands/handlers/request-approval.status.handler';
import { TimeOffRequestService } from '../time-off-request/time-off-request.service';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			User,
			RequestApproval,
			Employee,
			OrganizationTeam,
			Role,
			Organization,
			TimeOffRequest,
			EquipmentSharing
		]),
		CqrsModule,
		OrganizationTeamEmployeeModule
	],
	controllers: [RequestApprovalControler],
	providers: [
		RequestApprovalService,
		UserService,
		OrganizationTeamService,
		EmployeeService,
		RoleService,
		OrganizationService,
		RequestApprovalStatusHandler,
		EquipmentSharingService,
		TimeOffRequestService
	],
	exports: [RequestApprovalService]
})
export class RequestApprovalModule {}
