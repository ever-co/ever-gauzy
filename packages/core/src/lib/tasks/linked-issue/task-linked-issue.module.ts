import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { CommandHandlers } from './commands/handlers';
import { TaskLinkedIssueController } from './task-linked-issue.controller';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { TypeOrmTaskLinkedIssueRepository } from './repository/type-orm-linked-issue.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskLinkedIssue]),
		MikroOrmModule.forFeature([TaskLinkedIssue]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskLinkedIssueController],
	providers: [TaskLinkedIssueService, TypeOrmTaskLinkedIssueRepository, ...CommandHandlers],
	exports: [TaskLinkedIssueService]
})
export class TaskLinkedIssueModule {}
