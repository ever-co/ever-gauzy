import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { JobSearchOccupation } from './job-search-occupation.entity';
import { MikroOrmJobSearchOccupationRepository, TypeOrmJobSearchOccupationRepository } from './repository';

@Injectable()
export class JobSearchOccupationService extends TenantAwareCrudService<JobSearchOccupation> {
	constructor(
		typeOrmJobSearchOccupationRepository: TypeOrmJobSearchOccupationRepository,
		mikroOrmJobSearchOccupationRepository: MikroOrmJobSearchOccupationRepository
	) {
		super(typeOrmJobSearchOccupationRepository, mikroOrmJobSearchOccupationRepository);
	}
}
