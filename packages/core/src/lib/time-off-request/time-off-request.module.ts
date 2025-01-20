import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffRequestController } from './time-off-request.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RequestApprovalModule } from '../request-approval/request-approval.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTimeOffRequestRepository } from './repository/type-orm-time-off-request.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TimeOffRequest]),
		MikroOrmModule.forFeature([TimeOffRequest]),
		RolePermissionModule,
		forwardRef(() => RequestApprovalModule),
		CqrsModule
	],
	controllers: [TimeOffRequestController],
	providers: [TimeOffRequestService, TypeOrmTimeOffRequestRepository, ...CommandHandlers],
	exports: [TimeOffRequestService]
})
export class TimeOffRequestModule {}
