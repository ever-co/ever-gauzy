import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalControler } from './request-approval.controller';
import { RequestApprovalService } from './request-approval.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { Employee } from '../employee/employee.entity';

@Module({
	imports: [TypeOrmModule.forFeature([User, RequestApproval, Employee])],
	controllers: [RequestApprovalControler],
	providers: [RequestApprovalService, UserService],
	exports: [RequestApprovalService]
})
export class RequestApprovalModule {}
