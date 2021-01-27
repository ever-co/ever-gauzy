import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidatePersonalQualities,
	ICandidateInterview
} from '@gauzy/contracts';
import {
	CandidateInterview,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_personal_quality')
export class CandidatePersonalQualities
	extends TenantOrganizationBaseEntity
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
