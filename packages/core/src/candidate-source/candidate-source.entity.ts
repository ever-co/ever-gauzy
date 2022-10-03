import { Column, Entity, OneToOne } from 'typeorm';
import { ICandidate, ICandidateSource } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('candidate_source')
export class CandidateSource extends TenantOrganizationBaseEntity
	implements ICandidateSource {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne
    |--------------------------------------------------------------------------
    */

    @OneToOne(() => Candidate, (candidate) => candidate.source)
    candidate?: ICandidate;
}