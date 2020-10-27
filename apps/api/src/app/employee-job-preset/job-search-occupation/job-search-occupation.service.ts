import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { JobSearchOccupation } from './job-search-occupation.entity';

@Injectable()
export class JobSearchOccupationService extends CrudService<
	JobSearchOccupation
> {
	constructor(
		@InjectRepository(JobSearchOccupation)
		candidateSourceRepository: Repository<JobSearchOccupation>
	) {
		super(candidateSourceRepository);
	}
}
