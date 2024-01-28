import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
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
		candidateInterviewRepository: Repository<CandidateInterview>,
		@MikroInjectRepository(CandidateInterview)
		mikroCandidateInterviewRepository: EntityRepository<CandidateInterview>
	) {
		super(candidateInterviewRepository, mikroCandidateInterviewRepository);
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
