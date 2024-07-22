import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeUpworkJobsSearchCriterion } from '../employee-upwork-jobs-search-criterion.entity';

@Injectable()
export class TypeOrmEmployeeUpworkJobsSearchCriterionRepository extends Repository<EmployeeUpworkJobsSearchCriterion> {
    constructor(@InjectRepository(EmployeeUpworkJobsSearchCriterion) readonly repository: Repository<EmployeeUpworkJobsSearchCriterion>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
