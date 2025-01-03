import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { TaskRelatedIssueTypeController } from './related-issue-type.controller';
import { TaskRelatedIssueTypeService } from './related-issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/task-related-issue-types',
				module: TaskRelatedIssueTypeModule
			}
		]),
		TypeOrmModule.forFeature([TaskRelatedIssueType]),
		MikroOrmModule.forFeature([TaskRelatedIssueType]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [
		TaskRelatedIssueTypeController
	],
	providers: [
		TaskRelatedIssueTypeService,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [TypeOrmModule, MikroOrmModule, TaskRelatedIssueTypeService]
})
export class TaskRelatedIssueTypeModule { }
