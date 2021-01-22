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
	ICandidateInterview,
	DeepPartial
} from '@gauzy/common';
import { IsEnum, IsOptional } from 'class-validator';
import {
	Candidate,
	CandidateCriterionsRating,
	CandidateInterview,
	CandidateInterviewers,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('candidate_feedback')
export class CandidateFeedback
	extends TenantOrganizationBaseEntity
	implements ICandidateFeedback {
	constructor(input?: DeepPartial<CandidateFeedback>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	description: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating: number;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: String, enum: CandidateStatus })
	@IsEnum(CandidateStatus)
	@IsOptional()
	@Column({ nullable: true })
	status?: string;

	@ApiProperty({ type: CandidateInterviewers })
	@OneToOne(() => CandidateInterviewers)
	@JoinColumn()
	interviewer?: ICandidateInterviewers;

	@OneToMany(
		() => CandidateCriterionsRating,
		(criterionsRating) => criterionsRating.feedback,
		{
			cascade: true
		}
	)
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
