import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidatePersonalQualities,
	ICandidateInterview
} from '@gauzy/models';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { IsString } from 'class-validator';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('candidate_personal_quality')
export class CandidatePersonalQualities extends TenantBase
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
		(type) => CandidateInterview,
		(interview) => interview.personalQualities
	)
	interview: ICandidateInterview;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidatePersonalQualities: CandidatePersonalQualities) =>
			candidatePersonalQualities.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
