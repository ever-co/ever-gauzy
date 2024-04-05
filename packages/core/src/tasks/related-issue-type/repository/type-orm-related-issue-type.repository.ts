import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskRelatedIssueType } from '../related-issue-type.entity';

@Injectable()
export class TypeOrmTaskRelatedIssueTypeRepository extends Repository<TaskRelatedIssueType> {
    constructor(@InjectRepository(TaskRelatedIssueType) readonly repository: Repository<TaskRelatedIssueType>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
