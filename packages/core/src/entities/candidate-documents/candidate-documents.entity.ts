import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, ManyToOne } from 'typeorm';
import { ICandidateDocument, ICandidate } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Candidate, TenantOrganizationBaseEntity } from '../internal';

@Entity('candidate_document')
export class CandidateDocument
	extends TenantOrganizationBaseEntity
	implements ICandidateDocument {
	constructor(input?: DeepPartial<CandidateDocument>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@Column({ nullable: true })
	documentUrl: string;

	@ManyToOne(() => Candidate, (candidate) => candidate.documents, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
