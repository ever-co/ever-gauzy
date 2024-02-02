import { Repository } from 'typeorm';
import { TaskRelatedIssueType } from '../related-issue-type.entity';

export class TypeOrmTaskRelatedIssueTypeRepository extends Repository<TaskRelatedIssueType> { }
