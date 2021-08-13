import { Column, Entity, ManyToOne, OneToMany, JoinColumn, RelationId, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	ICandidate
} from '@gauzy/contracts';
import {
	Candidate,
	CandidateFeedback,
	CandidateInterviewers,
	CandidatePersonalQualities,
	CandidateTechnologies,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsOptional, IsString } from 'class-validator';

@Entity('candidate_interview')
export class CandidateInterview
	extends TenantOrganizationBaseEntity
	implements ICandidateInterview {
	@ApiProperty({ type: () => String })
	@Column()
	title: string;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	startTime: Date;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	endTime: Date;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	location?: string;

	@ApiProperty({ type: () => String })
	@Column()
	note?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ nullable: true, default: false })
	isArchived?: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => CandidateFeedback })
	@OneToMany(() => CandidateFeedback, (feedback) => feedback.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	feedbacks?: ICandidateFeedback[];

	@ApiProperty({ type: () => CandidateTechnologies })
	@OneToMany(() => CandidateTechnologies, (technologies) => technologies.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	technologies?: ICandidateTechnologies[];

	@ApiProperty({ type: () => CandidatePersonalQualities })
	@OneToMany(() => CandidatePersonalQualities, (personalQualities) => personalQualities.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	personalQualities?: ICandidatePersonalQualities[];

	@ApiProperty({ type: () => CandidateInterviewers })
	@OneToMany(() => CandidateInterviewers, (interviewers) => interviewers.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	interviewers?: ICandidateInterviewers[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.interview, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateInterview) => it.candidate)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	candidateId?: string;
}
