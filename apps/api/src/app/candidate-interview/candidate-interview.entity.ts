import { Column, Entity } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateInterview } from '@gauzy/models';

@Entity('candidate_interview')
export class CandidateInterview extends Base implements ICandidateInterview {
	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: Date })
	@Column()
	startTime: Date;

	@ApiProperty({ type: Date })
	@Column()
	endTime: Date;

	@ApiProperty({ type: String, isArray: true })
	interviewers: string[];

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@Column({ nullable: true })
	location: string;

	@ApiProperty({ type: String })
	@Column()
	note?: string;
}
