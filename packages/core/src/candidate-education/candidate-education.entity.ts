import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateEducation, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_education')
export class CandidateEducation extends TenantOrganizationBaseEntity
	implements ICandidateEducation {

	@ApiProperty({ type: () => String })
	@Column()
	schoolName: string;

	@ApiProperty({ type: () => String })
	@Column()
	degree: string;

	@ApiProperty({ type: () => String })
	@Column()
	field: string;

	@ApiProperty({ type: () => Date })
	@Column()
	completionDate: Date;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	notes?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.educations, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateEducation) => it.candidate)
	@Column({ nullable: true })
	candidateId?: string;
}
