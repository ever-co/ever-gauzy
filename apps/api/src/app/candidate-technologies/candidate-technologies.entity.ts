import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateTechnologies, ICandidateInterview } from '@gauzy/models';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { IsString } from 'class-validator';

@Entity('candidate_technology')
export class CandidateTechnologies extends TenantBase
	implements ICandidateTechnologies {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ManyToOne(() => CandidateInterview, (interview) => interview.technologies)
	interview: ICandidateInterview;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateTechnologies: CandidateTechnologies) =>
			candidateTechnologies.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
