import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateExperience } from './candidate-experience.entity';

@Injectable()
export class CandidateExperienceService extends CrudService<
	CandidateExperience
> {
	constructor(
		@InjectRepository(CandidateExperience)
		private readonly candidateExperienceRepository: Repository<
			CandidateExperience
		>
	) {
		super(candidateExperienceRepository);
	}
}
