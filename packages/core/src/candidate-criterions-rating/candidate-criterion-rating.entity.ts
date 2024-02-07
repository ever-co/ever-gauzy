import { Index, RelationId } from 'typeorm';
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
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateCriterionsRatingRepository } from './repository/mikro-orm-candidate-criterions-rating.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_criterion_rating', { mikroOrmRepository: () => MikroOrmCandidateCriterionsRatingRepository })
export class CandidateCriterionsRating extends TenantOrganizationBaseEntity
	implements ICandidateCriterionsRating {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
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
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMColumn({ nullable: true, relationId: true })
	feedbackId?: string;
}
