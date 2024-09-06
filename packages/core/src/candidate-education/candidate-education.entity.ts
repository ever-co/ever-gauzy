import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ICandidateEducation, ICandidate, ID } from '@gauzy/contracts';
import { Candidate, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmCandidateEducationRepository } from './repository/mikro-orm-candidate-education.repository';

@MultiORMEntity('candidate_education', { mikroOrmRepository: () => MikroOrmCandidateEducationRepository })
export class CandidateEducation extends TenantOrganizationBaseEntity implements ICandidateEducation {
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
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
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.educations, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	candidate?: ICandidate;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: CandidateEducation) => it.candidate)
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ID;
}
