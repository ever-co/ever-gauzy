import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ICandidateExperience, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_experience')
export class CandidateExperience
	extends TenantOrganizationBaseEntity
	implements ICandidateExperience {
	@ApiProperty({ type: () => String })
	@Column()
	occupation: string;

	@ApiProperty({ type: () => String })
	@Column()
	duration: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.experience, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateExperience) => it.candidate)
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;
}
