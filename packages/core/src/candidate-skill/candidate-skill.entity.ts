import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateSkill, ICandidate, ID } from '@gauzy/contracts';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';
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
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.skills, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateSkill) => it.candidate)
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ID;
}
