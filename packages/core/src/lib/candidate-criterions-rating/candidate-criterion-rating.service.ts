import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ICandidateCriterionsRating, ICandidateCriterionsRatingCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { TypeOrmCandidateCriterionsRatingRepository } from './repository/type-orm-candidate-criterions-rating.repository';
import { MikroOrmCandidateCriterionsRatingRepository } from './repository/mikro-orm-candidate-criterions-rating.repository';

@Injectable()
export class CandidateCriterionsRatingService extends TenantAwareCrudService<CandidateCriterionsRating> {
	constructor(
		@InjectRepository(CandidateCriterionsRating)
		typeOrmCandidateCriterionsRatingRepository: TypeOrmCandidateCriterionsRatingRepository,

		mikroOrmCandidateCriterionsRatingRepository: MikroOrmCandidateCriterionsRatingRepository
	) {
		super(typeOrmCandidateCriterionsRatingRepository, mikroOrmCandidateCriterionsRatingRepository);
	}

	/**
	 *
	 * @param technologyCreateInput
	 * @param qualityCreateInput
	 * @returns
	 */
	async createBulk(
		technologyCreateInput: ICandidateCriterionsRatingCreateInput[],
		qualityCreateInput: ICandidateCriterionsRatingCreateInput[]
	) {
		return [await this.typeOrmRepository.save(technologyCreateInput), await this.typeOrmRepository.save(qualityCreateInput)];
	}

	/***
	 *
	 */
	async getCriterionsByFeedbackId(feedbackId: string): Promise<CandidateCriterionsRating[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('candidate_feedback')
			.where('candidate_feedback.feedbackId = :feedbackId', {
				feedbackId
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

	/**
	 *
	 * @param tech
	 * @param qual
	 * @returns
	 */
	async updateBulk(tech: ICandidateCriterionsRating[], qual: ICandidateCriterionsRating[]) {
		return [await this.typeOrmRepository.save(tech), await this.typeOrmRepository.save(qual)];
	}
}
