import { Column, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateEducation, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateEducationRepository } from './repository/mikro-orm-candidate-education.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_education', { mikroOrmRepository: () => MikroOrmCandidateEducationRepository })
export class CandidateEducation extends TenantOrganizationBaseEntity
	implements ICandidateEducation {

	@ApiProperty({ type: () => String })
	@Column()
	schoolName: string;

	@ApiProperty({ type: () => String })
	@Column()
	degree: string;

	@ApiProperty({ type: () => String })
	@Column()
	field: string;

	@ApiProperty({ type: () => Date })
	@Column()
	completionDate: Date;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
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
	@Column({ nullable: true })
	candidateId?: string;
}
