import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IsString } from 'class-validator';
import { ICandidateCriterionsRating } from '@gauzy/models';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';

@Entity('candidate_criterion_rating')
export class CandidateCriterionsRating extends Base
	implements ICandidateCriterionsRating {
	@ApiProperty({ type: String })
	@Column()
	rating: number;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	technologyId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	personalQualityId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	feedbackId: string;

	@ManyToOne(
		(type) => CandidateFeedback,
		(feedback) => feedback.criterionsRating
	)
	feedback: CandidateFeedback;
}
