import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ICandidateDocument, ICandidate } from '@gauzy/contracts';
import { IsString } from 'class-validator';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_document')
export class CandidateDocument
	extends TenantOrganizationBaseEntity
	implements ICandidateDocument {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	documentUrl: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiPropertyOptional({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.documents, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateDocument) => it.candidate)
	@IsString()
	@Index()
	@Column({ nullable: true })
	candidateId?: string;
}
