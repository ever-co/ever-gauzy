import { Injectable } from '@nestjs/common';
import { CandidateEducation } from './candidate-education.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmCandidateEducationRepository } from './repository/type-orm-candidate-education.repository';
import { MikroOrmCandidateEducationRepository } from './repository/mikro-orm-candidate-education.repository';

@Injectable()
export class CandidateEducationService extends TenantAwareCrudService<CandidateEducation> {
	constructor(
		typeOrmCandidateEducationRepository: TypeOrmCandidateEducationRepository,
		mikroOrmCandidateEducationRepository: MikroOrmCandidateEducationRepository
	) {
		super(typeOrmCandidateEducationRepository, mikroOrmCandidateEducationRepository);
	}
}
