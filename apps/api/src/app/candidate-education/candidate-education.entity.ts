import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Education } from 'libs/models/src/lib/candidate-education.model';
import { Base } from '../core/entities/base';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('candidate_educations')
export class CandidateEducation extends Base implements Education {
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
	@Column()
	candidateId?: string;
}
