import { Skill } from './../../../../../libs/models/src/lib/candidate-skill.model';
import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('candidate_skills')
export class CandidateSkill extends Base implements Skill {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	candidateId?: string;
}
