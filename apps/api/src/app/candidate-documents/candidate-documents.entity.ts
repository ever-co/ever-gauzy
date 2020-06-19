import { Column, Entity, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateDocument, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';

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

	@ManyToOne((type) => Candidate, (candidate) => candidate.documents)
	candidate: ICandidate;
}
