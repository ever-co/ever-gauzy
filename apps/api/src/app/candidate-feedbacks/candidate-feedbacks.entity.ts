import {
	Column,
	Entity,
	OneToOne,
	JoinColumn,
	OneToMany,
	ManyToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateFeedback,
	CandidateStatus,
	ICandidateInterviewers,
	ICandidateCriterionsRating,
	Candidate as ICandidate,
	ICandidateInterview
} from '@gauzy/models';
import { IsEnum, IsOptional } from 'class-validator';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';
import { CandidateCriterionsRating } from '../candidate-criterions-rating/candidate-criterion-rating.entity';
import { Candidate } from '../candidate/candidate.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

@Entity('candidate_feedback')
export class CandidateFeedback extends Base implements ICandidateFeedback {
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
	@OneToOne((type) => CandidateInterviewers)
	@JoinColumn()
	interviewer?: ICandidateInterviewers;

	@OneToMany(
		(type) => CandidateCriterionsRating,
		(candidateCriterionsRating) => candidateCriterionsRating.feedback
	)
	@JoinColumn()
	criterionsRating?: ICandidateCriterionsRating[];

	@ManyToOne(
		(type) => CandidateInterview,
		(candidateInterview) => candidateInterview.feedbacks
	)
	interview: ICandidateInterview;

	@ManyToOne((type) => Candidate, (candidate) => candidate.feedbacks)
	candidate: ICandidate;
}
