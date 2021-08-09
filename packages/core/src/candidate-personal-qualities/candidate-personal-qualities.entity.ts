import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
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
import { IsOptional, IsString } from 'class-validator';

@Entity('candidate_personal_quality')
export class CandidatePersonalQualities
	extends TenantOrganizationBaseEntity
	implements ICandidatePersonalQualities {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => CandidateInterview })
	@ManyToOne(() => CandidateInterview, (interview) => interview.personalQualities, { 
		onDelete: 'CASCADE' 
	})
	interview?: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidatePersonalQualities) => it.interview)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	interviewId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => CandidateCriterionsRating })
	@OneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.personalQuality, { 
		cascade: true 
	})
	@JoinColumn()
	criterionsRatings?: ICandidateCriterionsRating[];
}
