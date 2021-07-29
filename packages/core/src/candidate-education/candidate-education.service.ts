import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEducation } from './candidate-education.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class CandidateEducationService extends TenantAwareCrudService<CandidateEducation> {
	constructor(
		@InjectRepository(CandidateEducation)
		private readonly candidateEducationRepository: Repository<CandidateEducation>
	) {
		super(candidateEducationRepository);
	}
}
