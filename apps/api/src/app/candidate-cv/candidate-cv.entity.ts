import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';
import { Base } from '../core/entities/base';
import { Candidate } from '../candidate/candidate.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('candidate_cv')
export class CandidateCv extends Base {
	@ApiProperty({ type: String, readOnly: true })
	@PrimaryGeneratedColumn()
	@Index()
	@IsString()
	@IsNotEmpty()
	id?: string;

	@ApiProperty({ type: String })
	@Column({ length: 500, nullable: true })
	@IsString()
	@IsNotEmpty()
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	cvUrl?: string;
	// @ManyToOne(
	// 	(type) => Candidate,
	// 	(candidate) => candidate.cv
	// )
	candidate?: Candidate;
}
