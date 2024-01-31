import { Repository } from 'typeorm';
import { TaskLinkedIssue } from '../task-linked-issue.entity';

export class TypeOrmTaskLinkedIssueRepository extends Repository<TaskLinkedIssue> { }
