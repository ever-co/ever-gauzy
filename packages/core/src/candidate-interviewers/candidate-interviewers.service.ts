import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { ICandidateInterviewersDeleteInput, ICandidateInterviewersCreateInput } from '@gauzy/contracts';

@Injectable()
export class CandidateInterviewersService extends TenantAwareCrudService<CandidateInterviewers> {
	constructor(
		@InjectRepository(CandidateInterviewers)
		candidateInterviewersRepository: Repository<CandidateInterviewers>,
		@MikroInjectRepository(CandidateInterviewers)
		mikroCandidateInterviewersRepository: EntityRepository<CandidateInterviewers>
	) {
		super(candidateInterviewersRepository, mikroCandidateInterviewersRepository);
	}

	async getInterviewersByInterviewId(interviewId: string): Promise<CandidateInterviewers[]> {
		return await this.repository
			.createQueryBuilder('candidate_interviewer')
			.where('candidate_interviewer.interviewId = :interviewId', {
				interviewId
			})
			.getMany();
	}

	async getInterviewersByEmployeeId(employeeId: ICandidateInterviewersDeleteInput): Promise<any> {
		return await this.repository
			.createQueryBuilder('candidate_interviewer')
			.where('candidate_interviewer.employeeId = :employeeId', {
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
