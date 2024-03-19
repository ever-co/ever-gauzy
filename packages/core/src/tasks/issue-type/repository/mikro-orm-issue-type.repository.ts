import { EntityRepository } from '@mikro-orm/knex';
import { IssueType } from '../issue-type.entity';

export class MikroOrmIssueTypeRepository extends EntityRepository<IssueType> { }
