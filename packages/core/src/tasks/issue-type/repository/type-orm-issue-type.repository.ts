import { Repository } from 'typeorm';
import { IssueType } from '../issue-type.entity';

export class TypeOrmIssueTypeRepository extends Repository<IssueType> { }