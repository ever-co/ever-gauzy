import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueType } from '../issue-type.entity';

@Injectable()
export class TypeOrmIssueTypeRepository extends Repository<IssueType> {
    constructor(@InjectRepository(IssueType) readonly repository: Repository<IssueType>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
