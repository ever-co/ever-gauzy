import { Entity, Column } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers } from '@gauzy/models';

@Entity('candidate_interviewers')
export class CandidateInterviewers extends Base
	implements ICandidateInterviewers {
	@ApiProperty({ type: String })
	@Column()
	interviewId: string;

	@ApiProperty({ type: String })
	@Column()
	employeeId: string;
}
