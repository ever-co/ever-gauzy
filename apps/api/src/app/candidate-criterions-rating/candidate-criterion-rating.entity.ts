import { Column, Entity, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ICandidateCriterionsRating } from '@gauzy/models';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { Organization } from '../organization/organization.entity';

@Entity('candidate_criterion_rating')
export class CandidateCriterionsRating extends TenantBase
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateCriterionsRating: CandidateCriterionsRating) =>
			candidateCriterionsRating.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
