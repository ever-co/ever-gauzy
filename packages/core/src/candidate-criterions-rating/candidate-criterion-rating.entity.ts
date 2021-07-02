import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ICandidateCriterionsRating } from '@gauzy/contracts';
import {
	CandidateFeedback,
	CandidatePersonalQualities,
	CandidateTechnologies,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_criterion_rating')
export class CandidateCriterionsRating
	extends TenantOrganizationBaseEntity
	implements ICandidateCriterionsRating {
	@ApiProperty({ type: () => String })
	@Column()
	rating: number;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.technology)
	@IsString()
	@Index()
	@Column({ nullable: true })
	technologyId?: string;

	@ManyToOne(() => CandidateTechnologies, (quality) => quality.criterionsRatings, {
		onDelete: 'CASCADE'
	})
	technology: CandidateTechnologies;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.personalQuality)
	@IsString()
	@Index()
	@Column({ nullable: true })
	personalQualityId?: string;

	@ManyToOne(() => CandidatePersonalQualities, (quality) => quality.criterionsRatings, {
		onDelete: 'CASCADE'
	})
	personalQuality: CandidatePersonalQualities;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.feedback)
	@IsString()
	@Index()
	@Column({ nullable: true })
	feedbackId: string;

	@ManyToOne(() => CandidateFeedback, (feedback) => feedback.criterionsRating, {
		onDelete: 'CASCADE'
	})
	feedback: CandidateFeedback;
}
