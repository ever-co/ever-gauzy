import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateInterview } from './candidate-interview.entity';

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
}
