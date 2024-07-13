import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPresetUpworkJobSearchCriterion } from '../job-preset-upwork-job-search-criterion.entity';

@Injectable()
export class TypeOrmJobPresetUpworkJobSearchCriterionRepository extends Repository<JobPresetUpworkJobSearchCriterion> {
    constructor(@InjectRepository(JobPresetUpworkJobSearchCriterion) readonly repository: Repository<JobPresetUpworkJobSearchCriterion>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
