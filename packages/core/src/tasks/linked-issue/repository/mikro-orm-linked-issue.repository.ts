import { EntityRepository } from '@mikro-orm/core';
import { TaskLinkedIssue } from '../task-linked-issue.entity';

export class MikroOrmTaskLinkedIssueRepository extends EntityRepository<TaskLinkedIssue> { }
