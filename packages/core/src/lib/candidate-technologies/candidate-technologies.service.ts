import { Injectable } from '@nestjs/common';
import { ICandidateTechnologies, ICandidateTechnologiesCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { findTenantInterviewCriteria } from './../candidate-interview/interview-criteria.helper';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { TypeOrmCandidateTechnologiesRepository } from './repository/type-orm-candidate-technologies.repository';
import { MikroOrmCandidateTechnologiesRepository } from './repository/mikro-orm-candidate-technologies.repository';

@Injectable()
export class CandidateTechnologiesService extends TenantAwareCrudService<CandidateTechnologies> {
	constructor(
		typeOrmCandidateTechnologiesRepository: TypeOrmCandidateTechnologiesRepository,
		mikroOrmCandidateTechnologiesRepository: MikroOrmCandidateTechnologiesRepository
	) {
		super(typeOrmCandidateTechnologiesRepository, mikroOrmCandidateTechnologiesRepository);
	}

	/**
	 *
	 * @param createInput
	 * @returns
	 */
	async createBulk(createInput: ICandidateTechnologiesCreateInput[]) {
		return await this.saveMany(createInput);
	}

	/**
	 *
	 * @param interviewId
	 * @returns
	 */
	async getTechnologiesByInterviewId(interviewId: string): Promise<ICandidateTechnologies[]> {
		const items = await findTenantInterviewCriteria(
			this.ormType,
			this.typeOrmRepository,
			this.mikroOrmRepository,
			interviewId
		);
		return items.map((item) => this.serialize(item));
	}
}
