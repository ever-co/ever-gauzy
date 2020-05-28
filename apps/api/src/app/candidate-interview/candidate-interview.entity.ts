import { Column, Entity, ManyToOne, JoinTable } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateInterviewers
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

	@ManyToOne((type) => CandidateInterviewers)
	@JoinTable({
		name: 'candidate_interviewers'
	})
	interviewers?: ICandidateInterviewers[];

	@ManyToOne((type) => CandidateFeedback)
	@JoinTable({
		name: 'candidate_feedbacks'
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
}
