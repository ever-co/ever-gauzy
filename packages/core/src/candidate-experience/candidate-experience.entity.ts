import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidateExperience, ICandidate, ID } from '@gauzy/contracts';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmCandidateExperienceRepository } from './repository/mikro-orm-candidate-experience.repository';
import { IsOptional, IsUUID } from 'class-validator';

@MultiORMEntity('candidate_experience', { mikroOrmRepository: () => MikroOrmCandidateExperienceRepository })
export class CandidateExperience extends TenantOrganizationBaseEntity implements ICandidateExperience {
	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	occupation: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	duration: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.experience, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CandidateExperience) => it.candidate)
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ID;
}
