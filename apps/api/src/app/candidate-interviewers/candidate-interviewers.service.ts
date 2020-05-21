import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import {
	ICandidateInterviewersDeleteInput,
	ICandidateInterviewersCreateInput
} from '@gauzy/models';

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

	async getInterviewersByInterviewId(
		interviewId: string
	): Promise<CandidateInterviewers[]> {
		return await this.repository
			.createQueryBuilder('candidate_interviewers')
			.where('candidate_interviewers.interviewId = :interviewId', {
				interviewId
			})
			.getMany();
	}

	async getInterviewersByEmployeeId(
		employeeId: ICandidateInterviewersDeleteInput
	): Promise<any> {
		return await this.repository
			.createQueryBuilder('candidate_interviewers')
			.where('candidate_interviewers.employeeId = :employeeId', {
				employeeId
			})
			.getMany();
	}

	async deleteBulk(ids: string[]) {
		return await this.repository.delete(ids);
	}
	async createBulk(createInput: ICandidateInterviewersCreateInput[]) {
		return await this.repository.save(createInput);
	}
}
