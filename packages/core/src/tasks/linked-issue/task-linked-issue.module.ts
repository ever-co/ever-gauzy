import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantModule } from './../../tenant/tenant.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TaskLinkedIssueController } from './task-linked-issue.controller';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { UserModule } from '../../user/user.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-linked-issue', module: TaskLinkedIssueModule }]),
		TypeOrmModule.forFeature([TaskLinkedIssue]),
		MikroOrmModule.forFeature([TaskLinkedIssue]),
		TenantModule,
		RolePermissionModule,
		UserModule,
		CqrsModule
	],
	controllers: [TaskLinkedIssueController],
	providers: [TaskLinkedIssueService],
	exports: [TaskLinkedIssueService]
})
export class TaskLinkedIssueModule { }
