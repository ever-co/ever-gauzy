import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ICandidateCriterionsRating, ICandidateFeedback, ICandidatePersonalQualities, ICandidateTechnologies } from '@gauzy/contracts';
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
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => CandidateTechnologies })
	@ManyToOne(() => CandidateTechnologies, (quality) => quality.criterionsRatings, {
		onDelete: 'CASCADE'
	})
	technology?: ICandidateTechnologies;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.technology)
	@IsString()
	@Index()
	@Column({ nullable: true })
	technologyId?: string;

	@ApiProperty({ type: () => CandidatePersonalQualities })
	@ManyToOne(() => CandidatePersonalQualities, (quality) => quality.criterionsRatings, {
		onDelete: 'CASCADE'
	})
	personalQuality?: ICandidatePersonalQualities;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.personalQuality)
	@IsString()
	@Index()
	@Column({ nullable: true })
	personalQualityId?: string;

	@ApiProperty({ type: () => CandidateFeedback })
	@ManyToOne(() => CandidateFeedback, (feedback) => feedback.criterionsRating, {
		onDelete: 'CASCADE'
	})
	feedback?: ICandidateFeedback;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.feedback)
	@IsString()
	@Index()
	@Column({ nullable: true })
	feedbackId?: string;
}
