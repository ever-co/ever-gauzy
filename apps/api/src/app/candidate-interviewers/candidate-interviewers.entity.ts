import { Entity, Column, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers, ICandidateInterview } from '@gauzy/models';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { IsString } from 'class-validator';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('candidate_interviewer')
export class CandidateInterviewers extends TenantBase
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateInterviewers: CandidateInterviewers) =>
			candidateInterviewers.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
