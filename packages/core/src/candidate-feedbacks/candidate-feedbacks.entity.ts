import {
	Column,
	Entity,
	OneToOne,
	JoinColumn,
	OneToMany,
	ManyToOne,
	RelationId,
	Index
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateFeedback,
	CandidateStatus,
	ICandidateInterviewers,
	ICandidateCriterionsRating,
	ICandidate,
	ICandidateInterview
} from '@gauzy/contracts';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
	Candidate,
	CandidateCriterionsRating,
	CandidateInterview,
	CandidateInterviewers,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_feedback')
export class CandidateFeedback
	extends TenantOrganizationBaseEntity
	implements ICandidateFeedback {
	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true, type: 'numeric' })
	rating: number;

	@ApiProperty({ type: () => String, enum: CandidateStatus })
	@IsEnum(CandidateStatus)
	@IsOptional()
	@Column({ nullable: true })
	status?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
   
	@ApiProperty({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.feedbacks, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateFeedback) => it.candidate)
	@IsString()
	@Index()
	@Column({ nullable: true })
	candidateId?: string;

	@ApiProperty({ type: () => CandidateInterview })
	@ManyToOne(() => CandidateInterview, (candidateInterview) => candidateInterview.feedbacks, {
		onDelete: 'CASCADE'
	})
	interview?: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateFeedback) => it.interview)
	@IsString()
	@Index()
	@Column({ nullable: true })
	interviewId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => CandidateCriterionsRating })
	@OneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.feedback, { 
		cascade: true 
	})
	criterionsRating?: ICandidateCriterionsRating[];

	/*
    |--------------------------------------------------------------------------
    | @OneToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => CandidateInterviewers })
	@OneToOne(() => CandidateInterviewers)
	@JoinColumn()
	interviewer?: ICandidateInterviewers;
}
