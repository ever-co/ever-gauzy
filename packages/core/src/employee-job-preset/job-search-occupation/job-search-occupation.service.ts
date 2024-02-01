import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { JobSearchOccupation } from './job-search-occupation.entity';
import { MikroOrmJobSearchOccupationRepository } from './repository/mikro-orm-job-search-occupation.repository';
import { TypeOrmJobSearchOccupationRepository } from './repository/type-orm-job-search-occupation.repository';

@Injectable()
export class JobSearchOccupationService extends TenantAwareCrudService<JobSearchOccupation> {
	constructor(
		@InjectRepository(JobSearchOccupation)
		typeOrmJobSearchOccupationRepository: TypeOrmJobSearchOccupationRepository,

		mikroOrmJobSearchOccupationRepository: MikroOrmJobSearchOccupationRepository
	) {
		super(typeOrmJobSearchOccupationRepository, mikroOrmJobSearchOccupationRepository);
	}
}
