import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { IsString, IsNotEmpty } from 'class-validator';
import { ISkill, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';

@Entity('candidate_skill')
export class CandidateSkill extends Base implements ISkill {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.skills)
	candidate: ICandidate;
}
