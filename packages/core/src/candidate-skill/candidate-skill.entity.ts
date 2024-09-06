import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateSkill, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmCandidateSkillRepository } from './repository/mikro-orm-candidate-skill.repository';

@MultiORMEntity('candidate_skill', { mikroOrmRepository: () => MikroOrmCandidateSkillRepository })
export class CandidateSkill extends TenantOrganizationBaseEntity implements ICandidateSkill {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Candidate })
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.skills, {
		onDelete: 'CASCADE',
		nullable: true,
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateSkill) => it.candidate)
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ICandidate['id'];
}
