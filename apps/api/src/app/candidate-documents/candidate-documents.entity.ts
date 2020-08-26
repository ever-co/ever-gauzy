import { Column, Entity, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateDocument, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { IsString } from 'class-validator';

@Entity('candidate_document')
export class CandidateDocument extends TenantBase
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateDocument: CandidateDocument) => candidateDocument.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
