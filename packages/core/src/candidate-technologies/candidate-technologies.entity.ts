import { Index, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateTechnologies, ICandidateInterview, ICandidateCriterionsRating } from '@gauzy/contracts';
import {
	CandidateCriterionsRating,
	CandidateInterview,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateTechnologiesRepository } from './repository/mikro-orm-candidate-technologies.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_technology', { mikroOrmRepository: () => MikroOrmCandidateTechnologiesRepository })
export class CandidateTechnologies extends TenantOrganizationBaseEntity implements ICandidateTechnologies {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	rating?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => CandidateInterview })
	@MultiORMManyToOne(() => CandidateInterview, (interview) => interview.technologies, {
		onDelete: 'CASCADE'
	})
	interview?: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateTechnologies) => it.interview)
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	interviewId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => CandidateCriterionsRating })
	@MultiORMOneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.technology, {
		cascade: true
	})
	@JoinColumn()
	criterionsRatings?: ICandidateCriterionsRating[];
}
