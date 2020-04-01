import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Candidate } from './candidate.entity';
import { CandidateCreateInput } from '@gauzy/models';

@Injectable()
export class CandidateService extends CrudService<Candidate> {
	constructor(
		@InjectRepository(Candidate)
		private readonly candidateRepository: Repository<Candidate>
	) {
		super(candidateRepository);
	}

	async createBulk(input: CandidateCreateInput[]) {
		return await this.repository.save(input);
	}
}
