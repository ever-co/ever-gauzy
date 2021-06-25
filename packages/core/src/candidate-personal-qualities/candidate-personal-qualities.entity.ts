import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidatePersonalQualities,
	ICandidateInterview,
	ICandidateCriterionsRating
} from '@gauzy/contracts';
import {
	CandidateCriterionsRating,
	CandidateInterview,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_personal_quality')
export class CandidatePersonalQualities
	extends TenantOrganizationBaseEntity
	implements ICandidatePersonalQualities {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ManyToOne(() => CandidateInterview, (interview) => interview.personalQualities, { 
		onDelete: 'CASCADE' 
	})
	interview: ICandidateInterview;

	@OneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.personalQuality, { 
		cascade: true 
	})
	@JoinColumn()
	criterionsRatings?: ICandidateCriterionsRating[];
}
