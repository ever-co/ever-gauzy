import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { DeepPartial, ICandidateCriterionsRating } from '@gauzy/common';
import { CandidateFeedback, TenantOrganizationBaseEntity } from '../internal';

@Entity('candidate_criterion_rating')
export class CandidateCriterionsRating
	extends TenantOrganizationBaseEntity
	implements ICandidateCriterionsRating {
	constructor(input?: DeepPartial<CandidateCriterionsRating>) {
		super(input);
	}

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

	@ManyToOne(() => CandidateFeedback, (feedback) => feedback.criterionsRating)
	feedback: CandidateFeedback;
}
