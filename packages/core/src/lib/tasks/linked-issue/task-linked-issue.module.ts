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
import { MikroOrmTaskLinkedIssueRepository } from './repository/mikro-orm-linked-issue.repository';
import { TaskLinkedIssueResolver } from './task-linked-issue.resolver';

/**
 * The relation one task has to another.
 *
 * `CqrsModule` is imported rather than re-exported because the resolver is a provider of *this*
 * module: a resolver can only inject services its own module can reach, so the command bus its two
 * writes dispatch through has to be reachable here rather than only by the controller beside it.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TaskLinkedIssue]),
		MikroOrmModule.forFeature([TaskLinkedIssue]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskLinkedIssueController],
	providers: [
		TaskLinkedIssueService,
		TaskLinkedIssueResolver,
		TypeOrmTaskLinkedIssueRepository,
		MikroOrmTaskLinkedIssueRepository,
		...CommandHandlers
	],
	exports: [TaskLinkedIssueService, CqrsModule]
})
export class TaskLinkedIssueModule {}