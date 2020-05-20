import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateInterview } from './candidate-interview.entity';
import { ICandidateInterview } from '@gauzy/models';

@Injectable()
export class CandidateInterviewService extends CrudService<CandidateInterview> {
	constructor(
		@InjectRepository(CandidateInterview)
		private readonly candidateInterviewRepository: Repository<
			CandidateInterview
		>
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
