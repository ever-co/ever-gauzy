import { ICandidateFeedback, ICandidateInterview } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateFeedback } from './candidate-feedbacks.entity';

@Injectable()
export class CandidateFeedbacksService extends TenantAwareCrudService<CandidateFeedback> {

	constructor(
		@InjectRepository(CandidateFeedback)
		private readonly candidateFeedbackRepository: Repository<CandidateFeedback>
	) {
		super(candidateFeedbackRepository);
	}

	async getFeedbacksByInterviewId(
		interviewId: ICandidateInterview['id']
	): Promise<ICandidateFeedback[]> {
		return await this.repository.find({
			where: {
				interviewId,
				tenantId: RequestContext.currentTenantId()
			}
		});
	}

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
