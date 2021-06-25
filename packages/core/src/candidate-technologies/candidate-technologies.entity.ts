import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateTechnologies, ICandidateInterview, ICandidateCriterionsRating } from '@gauzy/contracts';
import {
	CandidateCriterionsRating,
	CandidateInterview,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';

@Entity('candidate_technology')
export class CandidateTechnologies
	extends TenantOrganizationBaseEntity
	implements ICandidateTechnologies {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateTechnologies) => it.interview)
	@IsString()
	@Index()
	@Column({ nullable: true })
	interviewId?: string;

	@ManyToOne(() => CandidateInterview, (interview) => interview.technologies, { 
		onDelete: 'CASCADE' 
	})
	interview: ICandidateInterview;

	@OneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.technology, { 
		cascade: true 
	})
	@JoinColumn()
	criterionsRatings?: ICandidateCriterionsRating[];
}
