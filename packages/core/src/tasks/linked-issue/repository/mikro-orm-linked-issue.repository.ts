import { EntityRepository } from '@mikro-orm/knex';
import { TaskLinkedIssue } from '../task-linked-issue.entity';

export class MikroOrmTaskLinkedIssueRepository extends EntityRepository<TaskLinkedIssue> { }
