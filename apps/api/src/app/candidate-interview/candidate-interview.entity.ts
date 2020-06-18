import { CandidatePersonalQualities } from './../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from './../candidate-technologies/candidate-technologies.entity';
import {
	Column,
	Entity,
	ManyToOne,
	JoinTable,
	OneToMany,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	Candidate as ICandidate
} from '@gauzy/models';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { Candidate } from '../candidate/candidate.entity';

@Entity('candidate_interview')
export class CandidateInterview extends Base implements ICandidateInterview {
	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	startTime: Date;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	endTime: Date;

	@OneToMany(
		(type) => CandidateFeedback,
		(candidateFeedback) => candidateFeedback.interview
	)
	@JoinColumn()
	feedbacks?: ICandidateFeedback[];

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@Column({ nullable: true })
	location: string;

	@ApiProperty({ type: String })
	@Column()
	note?: string;

	@OneToMany(
		(type) => CandidateTechnologies,
		(candidateTechnologies) => candidateTechnologies.interview
	)
	@JoinColumn()
	technologies?: ICandidateTechnologies[];

	@OneToMany(
		(type) => CandidatePersonalQualities,
		(candidatePersonalQualities) => candidatePersonalQualities.interview
	)
	@JoinColumn()
	personalQualities?: ICandidatePersonalQualities[];

	@OneToMany(
		(type) => CandidateInterviewers,
		(candidateInterviewers) => candidateInterviewers.interview
	)
	@JoinColumn()
	interviewers?: ICandidateInterviewers[];

	@ManyToOne((type) => Candidate, (candidate) => candidate.interview)
	candidate: ICandidate;
}
