import { Injectable } from '@nestjs/common';
import { ICandidateInterview, ID } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmCandidateInterviewRepository } from './repository/type-orm-candidate-interview.repository';
import { MikroOrmCandidateInterviewRepository } from './repository/mikro-orm-candidate-interview.repository';
import { CandidateInterview } from './candidate-interview.entity';

@Injectable()
export class CandidateInterviewService extends TenantAwareCrudService<CandidateInterview> {
	constructor(
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
	async findByCandidateId(candidateId: ID): Promise<ICandidateInterview[]> {
		return await super.find({
			where: {
				candidateId,
				tenantId: RequestContext.currentTenantId()
			}
		});
	}
}
