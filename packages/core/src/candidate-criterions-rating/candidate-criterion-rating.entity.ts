import { Column, Index, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidateCriterionsRating,
	ICandidateFeedback,
	ICandidatePersonalQualities,
	ICandidateTechnologies
} from '@gauzy/contracts';
import {
	CandidateFeedback,
	CandidatePersonalQualities,
	CandidateTechnologies,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateCriterionsRatingRepository } from './repository/mikro-orm-candidate-criterions-rating.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_criterion_rating', { mikroOrmRepository: () => MikroOrmCandidateCriterionsRatingRepository })
export class CandidateCriterionsRating extends TenantOrganizationBaseEntity
	implements ICandidateCriterionsRating {

	@ApiProperty({ type: () => String })
	@Column()
	rating: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate Technologies
	 */
	@ApiProperty({ type: () => CandidateTechnologies })
	@MultiORMManyToOne(() => CandidateTechnologies, (quality) => quality.criterionsRatings, {
		onDelete: 'CASCADE'
	})
	technology?: ICandidateTechnologies;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.technology)
	@Index()
	@Column({ nullable: true })
	technologyId?: string;

	/**
	 * Candidate Personal Qualities
	 */
	@ApiProperty({ type: () => CandidatePersonalQualities })
	@MultiORMManyToOne(() => CandidatePersonalQualities, (quality) => quality.criterionsRatings, {
		onDelete: 'CASCADE'
	})
	personalQuality?: ICandidatePersonalQualities;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.personalQuality)
	@Index()
	@Column({ nullable: true })
	personalQualityId?: string;

	/**
	 * Candidate Feedback
	 */
	@ApiProperty({ type: () => CandidateFeedback })
	@MultiORMManyToOne(() => CandidateFeedback, (feedback) => feedback.criterionsRating, {
		onDelete: 'CASCADE'
	})
	feedback?: ICandidateFeedback;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateCriterionsRating) => it.feedback)
	@Index()
	@Column({ nullable: true })
	feedbackId?: string;
}
