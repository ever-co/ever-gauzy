import { EntityRepository } from '@mikro-orm/knex';
import { TaskRelatedIssueType } from '../related-issue-type.entity';

export class MikroOrmTaskRelatedIssueTypeRepository extends EntityRepository<TaskRelatedIssueType> { }
