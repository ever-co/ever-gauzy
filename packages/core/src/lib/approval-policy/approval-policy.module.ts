import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyController } from './approval-policy.controller';
import { ApprovalPolicyService } from './approval-policy.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmApprovalPolicyRepository } from './repository/type-orm-approval-policy.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ApprovalPolicy]),
		MikroOrmModule.forFeature([ApprovalPolicy]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ApprovalPolicyController],
	providers: [ApprovalPolicyService, TypeOrmApprovalPolicyRepository, ...CommandHandlers],
	exports: [ApprovalPolicyService]
})
export class ApprovalPolicyModule {}
