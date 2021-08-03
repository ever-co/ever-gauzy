import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import {
	ICandidateCriterionsRating,
	ICandidateCriterionsRatingCreateInput
} from '@gauzy/contracts';

@Injectable()
export class CandidateCriterionsRatingService extends TenantAwareCrudService<CandidateCriterionsRating> {
	constructor(
		@InjectRepository(CandidateCriterionsRating)
		private readonly candidateCriterionsRatingRepository: Repository<CandidateCriterionsRating>
	) {
		super(candidateCriterionsRatingRepository);
	}

	async createBulk(
		technologyCreateInput: ICandidateCriterionsRatingCreateInput[],
		qualityCreateInput: ICandidateCriterionsRatingCreateInput[]
	) {
		return [
			await this.repository.save(technologyCreateInput),
			await this.repository.save(qualityCreateInput)
		];
	}

	async getCriterionsByFeedbackId(
		feedbackId: string
	): Promise<CandidateCriterionsRating[]> {
		return await this.repository
			.createQueryBuilder('candidate_feedback')
			.where('candidate_feedback.feedbackId = :feedbackId', {
				feedbackId
			})
			.getMany();
	}
	
	async deleteBulk(ids: string[]) {
		return await this.repository.delete(ids);
	}

	async updateBulk(
		tech: ICandidateCriterionsRating[],
		qual: ICandidateCriterionsRating[]
	) {
		return [
			await this.repository.save(tech),
			await this.repository.save(qual)
		];
	}
}
