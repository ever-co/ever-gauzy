import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskLinkedIssue } from '../task-linked-issue.entity';

@Injectable()
export class TypeOrmTaskLinkedIssueRepository extends Repository<TaskLinkedIssue> {
    constructor(@InjectRepository(TaskLinkedIssue) readonly repository: Repository<TaskLinkedIssue>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
