import { Column, Entity } from 'typeorm';
import { Base } from '../core/entities/base';
import { ICandidateHistory } from '@gauzy/models';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@Entity('candidate_history')
export class CandidateHistory extends Base implements ICandidateHistory {
	@ApiProperty({ type: String })
	@Column()
	candidateName: string;

	@ApiProperty({ type: String })
	@Column()
	userName: string;

	@ApiProperty({ type: String })
	@Column()
	action: string;

	@ApiProperty({ type: String })
	@Column()
	subject: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;
}
