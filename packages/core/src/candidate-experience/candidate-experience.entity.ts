import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateExperience, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmCandidateExperienceRepository } from './repository/mikro-orm-candidate-experience.repository';

@MultiORMEntity('candidate_experience', { mikroOrmRepository: () => MikroOrmCandidateExperienceRepository })
export class CandidateExperience extends TenantOrganizationBaseEntity
	implements ICandidateExperience {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	occupation: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	duration: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Candidate })
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.experience, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateExperience) => it.candidate)
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: string;
}
