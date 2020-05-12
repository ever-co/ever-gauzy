import { ICandidateInterviewers } from './../../../../../libs/models/src/lib/candidate-interviewers.model';
import { Column, Entity, JoinTable, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateInterview } from '@gauzy/models';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';

@Entity('candidate_interview')
export class CandidateInterview extends Base implements ICandidateInterview {
	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: Date })
	@Column()
	startTime: Date;

	@ApiProperty({ type: Date })
	@Column()
	endTime: Date;

	@ManyToOne((type) => CandidateInterviewers)
	@JoinTable({
		name: 'candidate_interviewers'
	})
	interviewers?: ICandidateInterviewers[];

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
