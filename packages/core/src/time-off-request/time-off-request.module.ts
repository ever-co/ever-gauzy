import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from './time-off-request.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffRequestController } from './time-off-request.controller';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: 'time-off-request', module: TimeOffRequestModule }
		]),
		TypeOrmModule.forFeature([
			TimeOffRequest,
			Employee,
			TimeOffPolicy,
			RequestApproval,
			ApprovalPolicy
		]),
		CqrsModule,
		TenantModule,
		UserModule
	],
	controllers: [TimeOffRequestController],
	providers: [TimeOffRequestService, ...CommandHandlers],
	exports: [TimeOffRequestService, TypeOrmModule]
})
export class TimeOffRequestModule {}
