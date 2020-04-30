import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateHistory } from './candidate-history.entity';

@Injectable()
export class CandidateHistoryService extends CrudService<CandidateHistory> {
	constructor(
		@InjectRepository(CandidateHistory)
		private readonly candidateHistoryRepository: Repository<
			CandidateHistory
		>
	) {
		super(candidateHistoryRepository);
	}
}
