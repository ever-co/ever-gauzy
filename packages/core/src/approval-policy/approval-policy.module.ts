import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyController } from './approval-policy.controller';
import { ApprovalPolicyService } from './approval-policy.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/approval-policy', module: ApprovalPolicyModule }
		]),
		TypeOrmModule.forFeature([User, ApprovalPolicy]),
		TenantModule,
		CqrsModule
	],
	controllers: [ApprovalPolicyController],
	providers: [ApprovalPolicyService, UserService, ...CommandHandlers],
	exports: [TypeOrmModule, ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
