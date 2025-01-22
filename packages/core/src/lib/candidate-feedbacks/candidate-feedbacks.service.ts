import { Injectable } from '@nestjs/common';
import { ICandidateFeedback, ICandidateInterview } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { MikroOrmCandidateFeedbackRepository } from './repository/mikro-orm-candidate-feedback.repository';
import { TypeOrmCandidateFeedbackRepository } from './repository/type-orm-candidate-feedback.repository';

@Injectable()
export class CandidateFeedbacksService extends TenantAwareCrudService<CandidateFeedback> {
	constructor(
		typeOrmCandidateFeedbackRepository: TypeOrmCandidateFeedbackRepository,
		mikroOrmCandidateFeedbackRepository: MikroOrmCandidateFeedbackRepository
	) {
		super(typeOrmCandidateFeedbackRepository, mikroOrmCandidateFeedbackRepository);
	}

	/**
	 *
	 * @param interviewId
	 * @returns
	 */
	async getFeedbacksByInterviewId(interviewId: ICandidateInterview['id']): Promise<ICandidateFeedback[]> {
		return await super.find({
			where: {
				interviewId,
				tenantId: RequestContext.currentTenantId()
			}
		});
	}

	/**
	 *
	 * @param feedbacks
	 * @returns
	 */
	calcRating(feedbacks: ICandidateFeedback[]) {
		const rate: number[] = [];
		feedbacks.forEach((fb) => {
			rate.push(Number(fb.rating));
		});
		const fbSum = rate.reduce((sum, current) => {
			return sum + current;
		});
		return fbSum / feedbacks.length;
	}
}
