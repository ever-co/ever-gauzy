import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsString } from 'class-validator';
import { ICandidateDocument, ICandidate, ID } from '@gauzy/contracts';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmCandidateDocumentRepository } from './repository/mikro-orm-candidate-document.repository';

@MultiORMEntity('candidate_document', { mikroOrmRepository: () => MikroOrmCandidateDocumentRepository })
export class CandidateDocument extends TenantOrganizationBaseEntity implements ICandidateDocument {
	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	documentUrl: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.documents, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateDocument) => it.candidate)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ID;
}
