import { CandidatePersonalQualities } from './../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from './../candidate-technologies/candidate-technologies.entity';
import { Column, Entity, ManyToOne, JoinTable } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities
} from '@gauzy/models';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';

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

	@ManyToOne((type) => CandidateInterviewers, { cascade: true })
	@JoinTable({
		name: 'candidate_interviewer'
	})
	interviewers?: ICandidateInterviewers[];

	@ManyToOne((type) => CandidateFeedback, { cascade: true })
	@JoinTable({
		name: 'candidate_feedback'
	})
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
