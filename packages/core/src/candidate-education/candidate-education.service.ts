import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEducation } from './candidate-education.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class CandidateEducationService extends TenantAwareCrudService<CandidateEducation> {
	constructor(
		@InjectRepository(CandidateEducation)
		private readonly candidateEducationRepository: Repository<CandidateEducation>,
		@MikroInjectRepository(CandidateEducation)
		private readonly mikroCandidateEducationRepository: EntityRepository<CandidateEducation>
	) {
		super(candidateEducationRepository, mikroCandidateEducationRepository);
	}
}
