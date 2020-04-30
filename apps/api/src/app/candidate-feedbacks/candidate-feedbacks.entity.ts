import { Column, Entity } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateFeedback } from '@gauzy/models';

@Entity('candidate_feedbacks')
export class CandidateFeedback extends Base implements ICandidateFeedback {
	@ApiProperty({ type: String })
	@Column()
	description: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating: number;
}
