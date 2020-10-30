import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from './time-off-request.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffRequestControler } from './time-off-request.controller';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';
@Module({
	imports: [
		TypeOrmModule.forFeature([
			TimeOffRequest,
			Employee,
			User,
			TimeOffPolicy,
			RequestApproval,
			ApprovalPolicy
		]),
		CqrsModule,
		TenantModule
	],
	controllers: [TimeOffRequestControler],
	providers: [TimeOffRequestService, UserService],
	exports: [TypeOrmModule]
})
export class TimeOffRequestModule {}
