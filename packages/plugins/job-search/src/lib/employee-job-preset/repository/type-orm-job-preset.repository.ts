import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPreset } from '../job-preset.entity';

@Injectable()
export class TypeOrmJobPresetRepository extends Repository<JobPreset> {
    constructor(@InjectRepository(JobPreset) readonly repository: Repository<JobPreset>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
