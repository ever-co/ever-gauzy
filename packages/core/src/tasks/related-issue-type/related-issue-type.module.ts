import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from '../../tenant/tenant.module';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { TaskRelatedIssueTypeController } from './related-issue-type.controller';
import { TaskRelatedIssueTypeService } from './related-issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

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
		TenantModule,
		CqrsModule
	],
	controllers: [TaskRelatedIssueTypeController],
	providers: [TaskRelatedIssueTypeService, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskRelatedIssueTypeService]
})
export class TaskRelatedIssueTypeModule { }
