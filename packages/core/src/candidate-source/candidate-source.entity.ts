import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ICandidate, ICandidateSource } from '@gauzy/contracts';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('candidate_source')
export class CandidateSource
	extends TenantOrganizationBaseEntity
	implements ICandidateSource {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.source, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateSource) => it.candidate)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	candidateId?: string;
}
