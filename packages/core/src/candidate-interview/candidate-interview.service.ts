import { ICandidate, ICandidateInterview } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestContext } from 'core';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateInterview } from './candidate-interview.entity';

@Injectable()
export class CandidateInterviewService extends TenantAwareCrudService<CandidateInterview> {

	constructor(
		@InjectRepository(CandidateInterview)
		protected readonly candidateInterviewRepository: Repository<CandidateInterview>
	) {
		super(candidateInterviewRepository);
	}

	async findByCandidateId(candidateId: ICandidate['id']): Promise<ICandidateInterview[]> {
		return await this.repository.find({
			where: {
				candidateId,
				tenantId: RequestContext.currentTenantId()
			}
		});
	}
}
