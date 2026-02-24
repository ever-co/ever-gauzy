import { Injectable } from '@nestjs/common';
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
	 * Creates bulk candidate criterion ratings.
	 */
	async createBulk(
		technologyInputs: ICandidateCriterionsRatingCreateInput[] = [],
		qualityInputs: ICandidateCriterionsRatingCreateInput[] = []
	): Promise<CandidateCriterionsRating[]> {
		return this.saveBulk(technologyInputs, qualityInputs);
	}

	/**
	 * Updates bulk candidate criterion ratings.
	 */
	async updateBulk(
		technologyRatings: ICandidateCriterionsRating[] = [],
		qualityRatings: ICandidateCriterionsRating[] = []
	): Promise<CandidateCriterionsRating[]> {
		return this.saveBulk(technologyRatings, qualityRatings);
	}

	/**
	 * Fetch criterions by feedback ID.
	 */
	async getCriterionsByFeedbackId(feedbackId: ID): Promise<CandidateCriterionsRating[]> {
		return this.typeOrmRepository.find({
			where: { feedbackId }
		});
	}

	/**
	 * Shared bulk save logic.
	 */
	private async saveBulk(
		tech: Partial<CandidateCriterionsRating>[],
		qual: Partial<CandidateCriterionsRating>[]
	): Promise<CandidateCriterionsRating[]> {
		const [techResults, qualResults] = await Promise.all([
			tech.length ? this.saveMany(tech) : Promise.resolve([]),
			qual.length ? this.saveMany(qual) : Promise.resolve([])
		]);

		return [...techResults, ...qualResults];
	}
}
