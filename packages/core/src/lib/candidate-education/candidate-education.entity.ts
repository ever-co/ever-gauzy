import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateEducation, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmCandidateEducationRepository } from './repository/mikro-orm-candidate-education.repository';

@MultiORMEntity('candidate_education', { mikroOrmRepository: () => MikroOrmCandidateEducationRepository })
export class CandidateEducation extends TenantOrganizationBaseEntity
	implements ICandidateEducation {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	schoolName: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	degree: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	field: string;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	completionDate: Date;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	notes?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate })
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.educations, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateEducation) => it.candidate)
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: string;
}
