import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from './time-off-request.entity';
import { Employee } from '../employee/employee.entity';
import { TimeOffRequestController } from './time-off-request.controller';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: 'time-off-request', module: TimeOffRequestModule }]),
		TypeOrmModule.forFeature([TimeOffRequest, Employee, TimeOffPolicy, RequestApproval, ApprovalPolicy]),
		MikroOrmModule.forFeature([TimeOffRequest, Employee, TimeOffPolicy, RequestApproval, ApprovalPolicy]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TimeOffRequestController],
	providers: [TimeOffRequestService, ...CommandHandlers],
	exports: [TimeOffRequestService, TypeOrmModule]
})
export class TimeOffRequestModule { }
