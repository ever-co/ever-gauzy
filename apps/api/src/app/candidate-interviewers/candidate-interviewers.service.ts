import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateInterviewers } from './candidate-interviewers.entity';

@Injectable()
export class CandidateInterviewersService extends CrudService<
	CandidateInterviewers
> {
	constructor(
		@InjectRepository(CandidateInterviewers)
		private readonly candidateInterviewersRepository: Repository<
			CandidateInterviewers
		>
	) {
		super(candidateInterviewersRepository);
	}
}
