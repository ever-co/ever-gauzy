import { EntityRepository } from '@mikro-orm/core';
import { TaskRelatedIssueType } from '../related-issue-type.entity';

export class MikroOrmTaskRelatedIssueTypeRepository extends EntityRepository<TaskRelatedIssueType> { }
