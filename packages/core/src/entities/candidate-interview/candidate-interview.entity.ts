import { CandidatePersonalQualities } from './../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from './../candidate-technologies/candidate-technologies.entity';
import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	ICandidate
} from '@gauzy/common';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { Candidate } from '../candidate/candidate.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('candidate_interview')
export class CandidateInterview
	extends TenantOrganizationBase
	implements ICandidateInterview {
	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	startTime: Date;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	endTime: Date;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@Column({ nullable: true })
	location: string;

	@ApiProperty({ type: String })
	@Column()
	note?: string;

	@ApiPropertyOptional({ type: Boolean, default: false })
	@Column({ nullable: true, default: false })
	isArchived?: boolean;

	@ApiPropertyOptional({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@OneToMany(() => CandidateFeedback, (feedback) => feedback.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	feedbacks?: ICandidateFeedback[];

	@OneToMany(
		() => CandidateTechnologies,
		(technologies) => technologies.interview,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	technologies?: ICandidateTechnologies[];

	@OneToMany(
		() => CandidatePersonalQualities,
		(personalQualities) => personalQualities.interview,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	personalQualities?: ICandidatePersonalQualities[];

	@OneToMany(
		() => CandidateInterviewers,
		(interviewers) => interviewers.interview,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	interviewers?: ICandidateInterviewers[];

	@ManyToOne(() => Candidate, (candidate) => candidate.interview, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
