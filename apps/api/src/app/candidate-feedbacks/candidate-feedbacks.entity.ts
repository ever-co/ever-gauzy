import { ICandidateInterviewers } from './../../../../../libs/models/src/lib/candidate-interviewers.model';
import { Column, Entity, OneToOne, JoinColumn } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateFeedback, CandidateStatus } from '@gauzy/models';
import { IsEnum, IsOptional } from 'class-validator';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';

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

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: String, enum: CandidateStatus })
	@IsEnum(CandidateStatus)
	@IsOptional()
	@Column({ nullable: true, default: CandidateStatus.APPLIED })
	status?: string;
}
