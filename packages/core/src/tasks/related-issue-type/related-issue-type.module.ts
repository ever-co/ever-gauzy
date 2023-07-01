import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../../tenant/tenant.module';
import { TaskRelatedIssueTypes } from './related-issue-type.entity';
import { TaskRelatedIssueTypesController } from './related-issue-type.controller';
import { TaskRelatedIssueTypesService } from './related-issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/task-related-issue-types',
				module: TaskRelatedIssueTypesModule,
			},
		]),
		TypeOrmModule.forFeature([TaskRelatedIssueTypes]),
		TenantModule,
		CqrsModule,
	],
	controllers: [TaskRelatedIssueTypesController],
	providers: [
		TaskRelatedIssueTypesService,
		...QueryHandlers,
		...CommandHandlers,
	],
	exports: [TaskRelatedIssueTypesService],
})
export class TaskRelatedIssueTypesModule {}
