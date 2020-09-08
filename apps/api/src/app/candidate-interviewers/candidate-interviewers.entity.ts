import { Entity, Column, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers, ICandidateInterview } from '@gauzy/models';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { Base } from '../core/entities/base';

@Entity('candidate_interviewer')
export class CandidateInterviewers extends Base
	implements ICandidateInterviewers {
	@ApiProperty({ type: String })
	@Column()
	interviewId: string;

	@ApiProperty({ type: String })
	@Column()
	employeeId: string;

	@ManyToOne(
		(type) => CandidateInterview,
		(interview) => interview.interviewers
	)
	interview: ICandidateInterview;
}
