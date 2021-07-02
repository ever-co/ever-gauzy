import {
	Column,
	Entity,
	OneToOne,
	JoinColumn,
	OneToMany,
	ManyToOne
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
import { IsEnum, IsOptional } from 'class-validator';
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

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true, type: 'numeric' })
	rating: number;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: () => String, enum: CandidateStatus })
	@IsEnum(CandidateStatus)
	@IsOptional()
	@Column({ nullable: true })
	status?: string;

	@ApiProperty({ type: () => CandidateInterviewers })
	@OneToOne(() => CandidateInterviewers)
	@JoinColumn()
	interviewer?: ICandidateInterviewers;

	@OneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.feedback, { 
		cascade: true 
	})
	@JoinColumn()
	criterionsRating?: ICandidateCriterionsRating[];

	@ManyToOne(
		() => CandidateInterview,
		(candidateInterview) => candidateInterview.feedbacks,
		{
			onDelete: 'CASCADE'
		}
	)
	interview: ICandidateInterview;

	@ManyToOne(() => Candidate, (candidate) => candidate.feedbacks, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
