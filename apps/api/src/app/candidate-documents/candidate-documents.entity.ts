import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateDocument, ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('candidate_document')
export class CandidateDocument extends TenantOrganizationBase
	implements ICandidateDocument {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@Column({ nullable: true })
	documentUrl: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.documents, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
