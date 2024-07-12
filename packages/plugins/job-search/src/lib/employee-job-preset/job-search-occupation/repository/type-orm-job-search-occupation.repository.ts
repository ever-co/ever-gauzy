import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobSearchOccupation } from '../job-search-occupation.entity';

@Injectable()
export class TypeOrmJobSearchOccupationRepository extends Repository<JobSearchOccupation> {
    constructor(@InjectRepository(JobSearchOccupation) readonly repository: Repository<JobSearchOccupation>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
