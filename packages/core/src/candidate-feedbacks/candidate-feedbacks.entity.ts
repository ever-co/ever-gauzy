import {
	JoinColumn,
	RelationId,
	Index
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateFeedback,
	CandidateStatusEnum,
	ICandidateInterviewers,
	ICandidateCriterionsRating,
	ICandidate,
	ICandidateInterview
} from '@gauzy/contracts';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	Candidate,
	CandidateCriterionsRating,
	CandidateInterview,
	CandidateInterviewers,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateFeedbackRepository } from './repository/mikro-orm-candidate-feedback.repository';
import { MultiORMManyToOne, MultiORMOneToMany, MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_feedback', { mikroOrmRepository: () => MikroOrmCandidateFeedbackRepository })
export class CandidateFeedback extends TenantOrganizationBaseEntity
	implements ICandidateFeedback {

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	rating: number;

	@ApiProperty({ type: () => String, enum: CandidateStatusEnum })
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: CandidateStatusEnum
	})
	status?: CandidateStatusEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate })
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.feedbacks, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateFeedback) => it.candidate)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ICandidate['id'];

	/**
	 * Candidate Interview
	 */
	@ApiProperty({ type: () => CandidateInterview })
	@MultiORMManyToOne(() => CandidateInterview, (candidateInterview) => candidateInterview.feedbacks, {
		onDelete: 'CASCADE'
	})
	interview?: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateFeedback) => it.interview)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	interviewId?: ICandidateInterview['id'];
	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate Criterions Rating
	 */
	@ApiProperty({ type: () => CandidateCriterionsRating })
	@MultiORMOneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.feedback, {
		cascade: true
	})
	criterionsRating?: ICandidateCriterionsRating[];

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate Interviewers
	 */
	@ApiProperty({ type: () => CandidateInterviewers })
	@MultiORMOneToOne(() => CandidateInterviewers, { owner: true })
	@JoinColumn()
	interviewer?: ICandidateInterviewers;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateFeedback) => it.interviewer)
	@MultiORMColumn({ nullable: true, relationId: true })
	interviewerId?: ICandidateInterviewers['id'];
}
