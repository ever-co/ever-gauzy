import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateEducation } from './candidate-education.entity';

@Injectable()
export class CandidateEducationService extends CrudService<CandidateEducation> {
	constructor(
		@InjectRepository(CandidateEducation)
		private readonly candidateEducationRepository: Repository<
			CandidateEducation
		>
	) {
		super(candidateEducationRepository);
	}
	async deleteEducation(educationId) {
		const education = await this.candidateEducationRepository
			.createQueryBuilder('education')
			.getOne();
		if (!education) {
			throw new BadRequestException("This Education can't be deleted ");
		}

		return await this.delete(educationId);
	}
}
