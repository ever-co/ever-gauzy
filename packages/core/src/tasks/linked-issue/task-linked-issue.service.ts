import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TenantAwareCrudService } from '../../core/crud';

@Injectable()
export class TaskLinkedIssueService extends TenantAwareCrudService<TaskLinkedIssue> {
	constructor(
		@InjectRepository(TaskLinkedIssue)
		protected readonly taskLinkedIssueRepository: Repository<TaskLinkedIssue>,
		@MikroInjectRepository(TaskLinkedIssue)
		protected readonly mikroTaskLinkedIssueRepository: EntityRepository<TaskLinkedIssue>
	) {
		super(taskLinkedIssueRepository, mikroTaskLinkedIssueRepository);
	}
}
