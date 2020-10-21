import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyController } from './approval-policy.controller';
import { ApprovalPolicyService } from './approval-policy.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([User, ApprovalPolicy]), TenantModule],
	controllers: [ApprovalPolicyController],
	providers: [ApprovalPolicyService, UserService],
	exports: [TypeOrmModule, ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
