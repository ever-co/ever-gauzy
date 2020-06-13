import { Column, Entity } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateDocument } from '@gauzy/models';

@Entity('candidate_document')
export class CandidateDocument extends Base implements ICandidateDocument {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@Column({ nullable: true })
	documentUrl: string;
}
