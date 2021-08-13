import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { JobSearchOccupation } from './job-search-occupation.entity';

@Injectable()
export class JobSearchOccupationService extends TenantAwareCrudService<JobSearchOccupation> {
	constructor(
		@InjectRepository(JobSearchOccupation)
		candidateSourceRepository: Repository<JobSearchOccupation>
	) {
		super(candidateSourceRepository);
	}
}
