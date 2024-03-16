import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidatePersonalQualities,
	ICandidateInterview,
	ICandidateCriterionsRating
} from '@gauzy/contracts';
import {
	CandidateCriterionsRating,
	CandidateInterview,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsOptional, IsString } from 'class-validator';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmCandidatePersonalQualitiesRepository } from './repository/mikro-orm-candidate-personal-qualities.repository';

@MultiORMEntity('candidate_personal_quality', { mikroOrmRepository: () => MikroOrmCandidatePersonalQualitiesRepository })
export class CandidatePersonalQualities extends TenantOrganizationBaseEntity implements ICandidatePersonalQualities {

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
	@MultiORMManyToOne(() => CandidateInterview, (interview) => interview.personalQualities, {
		onDelete: 'CASCADE'
	})
	interview?: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidatePersonalQualities) => it.interview)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	interviewId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => CandidateCriterionsRating })
	@MultiORMOneToMany(() => CandidateCriterionsRating, (criterionsRating) => criterionsRating.personalQuality, {
		cascade: true
	})
	@JoinColumn()
	criterionsRatings?: ICandidateCriterionsRating[];
}
