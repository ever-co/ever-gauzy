import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IsString, IsNotEmpty } from 'class-validator';
import { IEducation, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';

@Entity('candidate_education')
export class CandidateEducation extends Base implements IEducation {
	@ApiProperty({ type: String })
	@Column()
	schoolName: string;

	@ApiProperty({ type: String })
	@Column()
	degree: string;

	@ApiProperty({ type: String })
	@Column()
	field: string;

	@ApiProperty({ type: Date })
	@Column()
	completionDate: Date;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.educations)
	candidate: ICandidate;
}
