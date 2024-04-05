import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobSearchCategory } from '../job-search-category.entity';

@Injectable()
export class TypeOrmJobSearchCategoryRepository extends Repository<JobSearchCategory> {
    constructor(@InjectRepository(JobSearchCategory) readonly repository: Repository<JobSearchCategory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
