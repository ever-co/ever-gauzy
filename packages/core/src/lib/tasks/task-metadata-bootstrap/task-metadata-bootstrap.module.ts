import { Module } from '@nestjs/common';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TagModule } from '../../tags/tag.module';
import { IssueTypeModule } from '../issue-type/issue-type.module';
import { TaskPriorityModule } from '../priorities/priority.module';
import { TaskRelatedIssueTypeModule } from '../related-issue-type/related-issue-type.module';
import { TaskSizeModule } from '../sizes/size.module';
import { TaskStatusModule } from '../statuses/status.module';
import { TaskVersionModule } from '../versions/version.module';
import { TaskMetadataBootstrapController } from './task-metadata-bootstrap.controller';
import { TaskMetadataBootstrapService } from './task-metadata-bootstrap.service';
import { TaskMetadataResolver } from '../task-metadata.resolver';

/**
 * The task vocabulary, served together.
 *
 * This module is the one place in the domain that already reaches all seven readers the vocabulary
 * needs — the six metadata services and the tag service — which is why the GraphQL view of those six
 * resources is declared here rather than in any one of their own modules: a resolver can only inject
 * the services its own module can reach, and no single metadata module reaches the other five. The
 * bootstrap route and the six connections are one surface over one vocabulary, so one module hosts
 * them.
 */
@Module({
	imports: [
		TaskStatusModule,
		TaskPriorityModule,
		TaskSizeModule,
		TagModule,
		TaskVersionModule,
		IssueTypeModule,
		TaskRelatedIssueTypeModule,
		RolePermissionModule
	],
	controllers: [TaskMetadataBootstrapController],
	providers: [TaskMetadataBootstrapService, TaskMetadataResolver],
	// What the resolver injects has to be reachable from the module the Apollo configuration names,
	// and a module's imports are not inherited: the six metadata modules and the tag module are
	// therefore re-exported here, which is what hands on the seven readers the vocabulary answer
	// needs. The bootstrap service is exported beside them for the same reason.
	exports: [
		TaskMetadataBootstrapService,
		TaskStatusModule,
		TaskPriorityModule,
		TaskSizeModule,
		TaskVersionModule,
		IssueTypeModule,
		TaskRelatedIssueTypeModule,
		TagModule
	]
})
export class TaskMetadataBootstrapModule {}
