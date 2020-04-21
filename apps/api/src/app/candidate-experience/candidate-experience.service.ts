import { Injectable, BadRequestException } from '@nestjs/common';
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
	async deleteExperience(experienceId) {
		const experience = await this.candidateExperienceRepository
			.createQueryBuilder('experience')
			.getOne();
		if (!experience) {
			throw new BadRequestException("This Experience can't be deleted ");
		}

		return await this.delete(experienceId);
	}
}
