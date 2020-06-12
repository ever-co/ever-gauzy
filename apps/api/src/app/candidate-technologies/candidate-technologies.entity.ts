import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { ICandidateTechnologies } from '@gauzy/models';

@Entity('candidate_technology')
export class CandidateTechnologies extends Base
	implements ICandidateTechnologies {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;
}
