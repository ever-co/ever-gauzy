import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { ICandidateTechnologiesCreateInput } from '@gauzy/models';

@Injectable()
export class CandidateTechnologiesService extends CrudService<
	CandidateTechnologies
> {
	constructor(
		@InjectRepository(CandidateTechnologies)
		private readonly candidateTechnologiesRepository: Repository<
			CandidateTechnologies
		>
	) {
		super(candidateTechnologiesRepository);
	}
	async createBulk(createInput: ICandidateTechnologiesCreateInput[]) {
		return await this.repository.save(createInput);
	}
	async getTechnologiesByInterviewId(
		interviewId: string
	): Promise<CandidateTechnologies[]> {
		return await this.repository
			.createQueryBuilder('candidate_technology')
			.where('candidate_technology.interviewId = :interviewId', {
				interviewId
			})
			.getMany();
	}
	async deleteBulk(ids: string[]) {
		return await this.repository.delete(ids);
	}
}
