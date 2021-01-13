import { Entity, Column, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers, ICandidateInterview } from '@gauzy/common';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('candidate_interviewer')
export class CandidateInterviewers
	extends TenantOrganizationBase
	implements ICandidateInterviewers {
	@ApiProperty({ type: String })
	@Column()
	interviewId: string;

	@ApiProperty({ type: String })
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
