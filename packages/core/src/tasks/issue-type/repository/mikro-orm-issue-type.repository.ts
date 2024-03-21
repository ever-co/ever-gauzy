import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { IssueType } from '../issue-type.entity';

export class MikroOrmIssueTypeRepository extends MikroOrmBaseEntityRepository<IssueType> { }
