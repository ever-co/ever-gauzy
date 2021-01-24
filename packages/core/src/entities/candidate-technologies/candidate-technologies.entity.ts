import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateTechnologies, ICandidateInterview } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { CandidateInterview, TenantOrganizationBaseEntity } from '../internal';

@Entity('candidate_technology')
export class CandidateTechnologies
	extends TenantOrganizationBaseEntity
	implements ICandidateTechnologies {
	constructor(input?: DeepPartial<CandidateTechnologies>) {
		super(input);
	}

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
		(interview) => interview.technologies,
		{
			onDelete: 'CASCADE'
		}
	)
	interview: ICandidateInterview;
}
