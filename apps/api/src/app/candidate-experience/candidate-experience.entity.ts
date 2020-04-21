import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { Experience } from 'libs/models/src/lib/candidate-experience.model';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('candidate_experience')
export class CandidateExperience extends Base implements Experience {
	@ApiProperty({ type: String })
	@Column()
	occupation: string;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String })
	@Column()
	duration: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	candidateId?: string;
}
