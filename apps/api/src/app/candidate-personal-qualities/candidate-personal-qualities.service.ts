import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { ICandidatePersonalQualitiesCreateInput } from '@gauzy/models';

@Injectable()
export class CandidatePersonalQualitiesService extends CrudService<
	CandidatePersonalQualities
> {
	constructor(
		@InjectRepository(CandidatePersonalQualities)
		private readonly candidatePersonalQualitiesRepository: Repository<
			CandidatePersonalQualities
		>
	) {
		super(candidatePersonalQualitiesRepository);
	}
	async createBulk(createInput: ICandidatePersonalQualitiesCreateInput[]) {
		return await this.repository.save(createInput);
	}
	async getPersonalQualitiesByInterviewId(
		interviewId: string
	): Promise<CandidatePersonalQualities[]> {
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
