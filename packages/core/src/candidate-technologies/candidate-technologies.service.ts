import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { ICandidateTechnologies, ICandidateTechnologiesCreateInput } from '@gauzy/contracts';

@Injectable()
export class CandidateTechnologiesService extends TenantAwareCrudService<CandidateTechnologies> {
	constructor(
		@InjectRepository(CandidateTechnologies)
		private readonly candidateTechnologiesRepository: Repository<CandidateTechnologies>
	) {
		super(candidateTechnologiesRepository);
	}
	
	async createBulk(createInput: ICandidateTechnologiesCreateInput[]) {
		return await this.repository.save(createInput);
	}
	
	async getTechnologiesByInterviewId(
		interviewId: string
	): Promise<ICandidateTechnologies[]> {
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
