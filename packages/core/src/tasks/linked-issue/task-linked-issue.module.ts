import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';

import { TenantModule } from './../../tenant/tenant.module';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TaskLinkedIssueController } from './task-linked-issue.controller';
import { TaskLinkedIssueService } from './task-linked-issue.service';
import { UserModule } from '../../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/task-linked-issue', module: TaskLinkedIssueModule },
		]),
		TypeOrmModule.forFeature([TaskLinkedIssue]),
		TenantModule,
		CqrsModule,
		UserModule,
	],
	controllers: [TaskLinkedIssueController],
	providers: [TaskLinkedIssueService],
	exports: [TaskLinkedIssueService],
})
export class TaskLinkedIssueModule {}
