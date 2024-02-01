import { Column, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateSkill, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateSkillRepository } from './repository/mikro-orm-candidate-skill.repository';

@MultiORMEntity('candidate_skill', { mikroOrmRepository: () => MikroOrmCandidateSkillRepository })
export class CandidateSkill extends TenantOrganizationBaseEntity implements ICandidateSkill {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Candidate })
	@ManyToOne(() => Candidate, (candidate) => candidate.skills, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateSkill) => it.candidate)
	@Column({ nullable: true })
	candidateId?: ICandidate['id'];
}
