import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateInterview } from './candidate-interview.entity';

@Injectable()
export class CandidateInterviewService extends TenantAwareCrudService<CandidateInterview> {
	constructor(
		@InjectRepository(CandidateInterview)
		private readonly candidateInterviewRepository: Repository<CandidateInterview>
	) {
		super(candidateInterviewRepository);
	}

	async findByCandidateId(
		candidateId: string
	): Promise<CandidateInterview[]> {
		return await this.repository
			.createQueryBuilder('candidate_interview')
			.where('candidate_interview.candidateId = :candidateId', {
				candidateId
			})
			.getMany();
	}
}
