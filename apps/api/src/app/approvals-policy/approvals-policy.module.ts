import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsPolicy } from './approvals-policy.entity';
import { ApprovalsPolicyControler } from './approvals-policy.controller';
import { ApprovalsPolicyService } from './approvals-policy.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

@Module({
	imports: [TypeOrmModule.forFeature([User, ApprovalsPolicy])],
	controllers: [ApprovalsPolicyControler],
	providers: [ApprovalsPolicyService, UserService],
	exports: [TypeOrmModule, ApprovalsPolicyService]
})
export class ApprovalsPolicyModule {}
