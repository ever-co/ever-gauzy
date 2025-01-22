import { Injectable } from '@nestjs/common';
import { ICandidatePersonalQualities, ICandidatePersonalQualitiesCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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
		return await this.typeOrmRepository.save(createInput);
	}

	/**
	 *
	 * @param interviewId
	 * @returns
	 */
	async getPersonalQualitiesByInterviewId(interviewId: string): Promise<ICandidatePersonalQualities[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('candidate_personal_quality')
			.where('candidate_personal_quality.interviewId = :interviewId', {
				interviewId
			})
			.getMany();
	}

	/**
	 *
	 * @param ids
	 * @returns
	 */
	async deleteBulk(ids: string[]) {
		return await this.typeOrmRepository.delete(ids);
	}
}
