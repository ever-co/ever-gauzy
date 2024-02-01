import { EntityRepository } from '@mikro-orm/core';
import { IssueType } from '../issue-type.entity';

export class MikroOrmIssueTypeRepository extends EntityRepository<IssueType> { }