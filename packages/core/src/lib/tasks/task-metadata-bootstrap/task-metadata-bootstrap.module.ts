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
	providers: [TaskMetadataBootstrapService]
})
export class TaskMetadataBootstrapModule {}
