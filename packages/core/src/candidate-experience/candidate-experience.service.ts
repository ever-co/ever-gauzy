import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateExperience } from './candidate-experience.entity';

@Injectable()
export class CandidateExperienceService extends TenantAwareCrudService<CandidateExperience> {
	constructor(
		@InjectRepository(CandidateExperience)
		private readonly candidateExperienceRepository: Repository<CandidateExperience>
	) {
		super(candidateExperienceRepository);
	}
}
