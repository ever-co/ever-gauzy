import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ICandidateCriterionsRating, ICandidateCriterionsRatingCreateInput, ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { TypeOrmCandidateCriterionsRatingRepository } from './repository/type-orm-candidate-criterions-rating.repository';
import { MikroOrmCandidateCriterionsRatingRepository } from './repository/mikro-orm-candidate-criterions-rating.repository';

@Injectable()
export class CandidateCriterionsRatingService extends TenantAwareCrudService<CandidateCriterionsRating> {
	constructor(
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
		const techResults = await this.saveMany(technologyCreateInput);
		const qualResults = await this.saveMany(qualityCreateInput);
		return [techResults, qualResults];
	}

	/***
	 *
	 */
	async getCriterionsByFeedbackId(feedbackId: ID): Promise<CandidateCriterionsRating[]> {
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
	async deleteBulk(ids: ID[]) {
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as any);
		}
	}

	/**
	 *
	 * @param tech
	 * @param qual
	 * @returns
	 */
	async updateBulk(tech: ICandidateCriterionsRating[], qual: ICandidateCriterionsRating[]) {
		const techResults = await this.saveMany(tech);
		const qualResults = await this.saveMany(qual);
		return [techResults, qualResults];
	}
}
