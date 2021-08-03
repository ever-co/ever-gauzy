import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { ICandidatePersonalQualities, ICandidatePersonalQualitiesCreateInput } from '@gauzy/contracts';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';

@Injectable()
export class CandidatePersonalQualitiesService extends TenantAwareCrudService<CandidatePersonalQualities> {
	constructor(
		@InjectRepository(CandidatePersonalQualities)
		private readonly candidatePersonalQualitiesRepository: Repository<CandidatePersonalQualities>
	) {
		super(candidatePersonalQualitiesRepository);
	}

	async createBulk(createInput: ICandidatePersonalQualitiesCreateInput[]) {
		return await this.repository.save(createInput);
	}

	async getPersonalQualitiesByInterviewId(
		interviewId: string
	): Promise<ICandidatePersonalQualities[]> {
		return await this.repository
			.createQueryBuilder('candidate_personal_quality')
			.where('candidate_personal_quality.interviewId = :interviewId', {
				interviewId
			})
			.getMany();
	}

	async deleteBulk(ids: string[]) {
		return await this.repository.delete(ids);
	}
}
