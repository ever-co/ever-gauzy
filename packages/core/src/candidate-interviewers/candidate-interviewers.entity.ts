import { Entity, Column, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers, ICandidateInterview } from '@gauzy/contracts';
import {
	CandidateInterview,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_interviewer')
export class CandidateInterviewers
	extends TenantOrganizationBaseEntity
	implements ICandidateInterviewers {
	@ApiProperty({ type: () => String })
	@Column()
	interviewId: string;

	@ApiProperty({ type: () => String })
	@Column()
	employeeId: string;

	@ManyToOne(
		() => CandidateInterview,
		(interview) => interview.interviewers,
		{
			onDelete: 'CASCADE'
		}
	)
	interview: ICandidateInterview;
}
