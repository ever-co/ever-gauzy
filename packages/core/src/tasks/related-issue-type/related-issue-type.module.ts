import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from '../../tenant/tenant.module';
import { TaskRelatedIssueTypes } from './related-issue-type.entity';
import { TaskRelatedIssueTypesController } from './related-issue-type.controller';
import { TaskRelatedIssueTypesService } from './related-issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/task-related-issue-types',
				module: TaskRelatedIssueTypesModule
			}
		]),
		TypeOrmModule.forFeature([TaskRelatedIssueTypes]),
		MikroOrmModule.forFeature([TaskRelatedIssueTypes]),
		TenantModule,
		CqrsModule
	],
	controllers: [TaskRelatedIssueTypesController],
	providers: [TaskRelatedIssueTypesService, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskRelatedIssueTypesService]
})
export class TaskRelatedIssueTypesModule { }
