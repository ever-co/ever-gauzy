import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyController } from './approval-policy.controller';
import { ApprovalPolicyService } from './approval-policy.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/approval-policy', module: ApprovalPolicyModule }]),
		TypeOrmModule.forFeature([ApprovalPolicy]),
		MikroOrmModule.forFeature([ApprovalPolicy]),
		TenantModule,
		UserModule,
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ApprovalPolicyController],
	providers: [ApprovalPolicyService, ...CommandHandlers],
	exports: [ApprovalPolicyService]
})
export class ApprovalPolicyModule { }
