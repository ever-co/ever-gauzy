import {
	Column,
	Entity,
	OneToOne,
	JoinColumn,
	ManyToOne,
	JoinTable
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateFeedback,
	CandidateStatus,
	ICandidateInterviewers,
	ICandidatePersonalQualities,
	ICandidateTechnologies
} from '@gauzy/models';
import { IsEnum, IsOptional } from 'class-validator';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';

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

	@ManyToOne((type) => CandidateTechnologies, { cascade: true })
	@JoinTable({
		name: 'candidate_technology'
	})
	technologies?: ICandidateTechnologies[];

	@ManyToOne((type) => CandidatePersonalQualities, { cascade: true })
	@JoinTable({
		name: 'candidate_personal_quality'
	})
	personalQualities?: ICandidatePersonalQualities[];
}
