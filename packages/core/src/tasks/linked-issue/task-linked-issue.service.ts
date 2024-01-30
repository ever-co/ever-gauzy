import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TaskLinkedIssue } from './task-linked-issue.entity';
import { TenantAwareCrudService } from '../../core/crud';
import { MikroOrmTaskLinkedIssueRepository } from './repository/mikro-orm-linked-issue.repository';
import { TypeOrmTaskLinkedIssueRepository } from './repository/type-orm-linked-issue.repository';

@Injectable()
export class TaskLinkedIssueService extends TenantAwareCrudService<TaskLinkedIssue> {
	constructor(
		@InjectRepository(TaskLinkedIssue)
		typeOrmTaskLinkedIssueRepository: TypeOrmTaskLinkedIssueRepository,

		mikroOrmTaskLinkedIssueRepository: MikroOrmTaskLinkedIssueRepository
	) {
		super(typeOrmTaskLinkedIssueRepository, mikroOrmTaskLinkedIssueRepository);
	}
}
