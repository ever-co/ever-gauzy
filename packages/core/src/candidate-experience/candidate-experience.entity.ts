import { Column, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateExperience, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateExperienceRepository } from './repository/mikro-orm-candidate-experience.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_experience', { mikroOrmRepository: () => MikroOrmCandidateExperienceRepository })
export class CandidateExperience extends TenantOrganizationBaseEntity
	implements ICandidateExperience {

	@ApiProperty({ type: () => String })
	@Column()
	occupation: string;

	@ApiProperty({ type: () => String })
	@Column()
	duration: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
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
	@Column({ nullable: true })
	candidateId?: string;
}
