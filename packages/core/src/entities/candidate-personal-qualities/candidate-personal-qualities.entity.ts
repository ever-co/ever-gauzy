import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidatePersonalQualities,
	ICandidateInterview
} from '@gauzy/common';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('candidate_personal_quality')
export class CandidatePersonalQualities
	extends TenantOrganizationBase
	implements ICandidatePersonalQualities {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ManyToOne(
		() => CandidateInterview,
		(interview) => interview.personalQualities,
		{
			onDelete: 'CASCADE'
		}
	)
	interview: ICandidateInterview;
}
