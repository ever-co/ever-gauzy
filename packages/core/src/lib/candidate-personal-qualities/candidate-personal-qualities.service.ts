import { Injectable } from '@nestjs/common';
import { ICandidatePersonalQualities, ICandidatePersonalQualitiesCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { findTenantInterviewCriteria } from './../candidate-interview/interview-criteria.helper';
import { TypeOrmCandidatePersonalQualitiesRepository } from './repository/type-orm-candidate-personal-qualities.repository';
import { MikroOrmCandidatePersonalQualitiesRepository } from './repository/mikro-orm-candidate-personal-qualities.repository';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';

@Injectable()
export class CandidatePersonalQualitiesService extends TenantAwareCrudService<CandidatePersonalQualities> {
	constructor(
		typeOrmCandidatePersonalQualitiesRepository: TypeOrmCandidatePersonalQualitiesRepository,
		mikroOrmCandidatePersonalQualitiesRepository: MikroOrmCandidatePersonalQualitiesRepository
	) {
		super(typeOrmCandidatePersonalQualitiesRepository, mikroOrmCandidatePersonalQualitiesRepository);
	}

	/**
	 *
	 * @param createInput
	 * @returns
	 */
	async createBulk(createInput: ICandidatePersonalQualitiesCreateInput[]) {
		return await this.saveMany(createInput);
	}

	/**
	 *
	 * @param interviewId
	 * @returns
	 */
	async getPersonalQualitiesByInterviewId(interviewId: string): Promise<ICandidatePersonalQualities[]> {
		const items = await findTenantInterviewCriteria(
			this.ormType,
			this.typeOrmRepository,
			this.mikroOrmRepository,
			interviewId
		);
		return items.map((item) => this.serialize(item));
	}
}
