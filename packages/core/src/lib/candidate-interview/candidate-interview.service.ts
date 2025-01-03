import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ICandidate, ICandidateInterview } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmCandidateInterviewRepository } from './repository/type-orm-candidate-interview.repository';
import { MikroOrmCandidateInterviewRepository } from './repository/mikro-orm-candidate-interview.repository';
import { CandidateInterview } from './candidate-interview.entity';

@Injectable()
export class CandidateInterviewService extends TenantAwareCrudService<CandidateInterview> {
	constructor(
		@InjectRepository(CandidateInterview)
		typeOrmCandidateInterviewRepository: TypeOrmCandidateInterviewRepository,

		mikroOrmCandidateInterviewRepository: MikroOrmCandidateInterviewRepository
	) {
		super(typeOrmCandidateInterviewRepository, mikroOrmCandidateInterviewRepository);
	}

	/**
	 *
	 * @param candidateId
	 * @returns
	 */
	async findByCandidateId(
		candidateId: ICandidate['id']
	): Promise<ICandidateInterview[]> {
		return await super.find({
			where: {
				candidateId,
				tenantId: RequestContext.currentTenantId()
			}
		});
	}
}
