import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
// tslint:disable-next-line: nx-enforce-module-boundaries
import { Education } from 'libs/models/src/lib/candidate-education.model';
import { Base } from '../core/entities/base';

@Entity('candidate_education')
export class CandidateEducation extends Base implements Education {
	@ApiProperty({ type: String })
	@Column()
	schooolName?: string;

	@ApiProperty({ type: String })
	@Column()
	degree?: string;

	@ApiProperty({ type: String })
	@Column()
	field?: string;

	@ApiProperty({ type: Date })
	@Column()
	completionDate?: Date;

	@ApiProperty({ type: String })
	@Column()
	notes?: string;
}
