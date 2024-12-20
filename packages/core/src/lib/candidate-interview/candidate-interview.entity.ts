import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ICandidateInterview,
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidatePersonalQualities,
	ICandidate
} from '@gauzy/contracts';
import {
	Candidate,
	CandidateFeedback,
	CandidateInterviewers,
	CandidatePersonalQualities,
	CandidateTechnologies,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmCandidateInterviewRepository } from './repository/mikro-orm-candidate-interview.repository';

@MultiORMEntity('candidate_interview', { mikroOrmRepository: () => MikroOrmCandidateInterviewRepository })
export class CandidateInterview extends TenantOrganizationBaseEntity implements ICandidateInterview {
	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	title: string;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	startTime: Date;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	endTime: Date;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	location?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	rating?: number;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => CandidateFeedback })
	@MultiORMOneToMany(() => CandidateFeedback, (feedback) => feedback.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	feedbacks?: ICandidateFeedback[];

	@ApiProperty({ type: () => CandidateTechnologies })
	@MultiORMOneToMany(() => CandidateTechnologies, (technologies) => technologies.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	technologies?: ICandidateTechnologies[];

	@ApiProperty({ type: () => CandidatePersonalQualities })
	@MultiORMOneToMany(() => CandidatePersonalQualities, (personalQualities) => personalQualities.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	personalQualities?: ICandidatePersonalQualities[];

	@ApiProperty({ type: () => CandidateInterviewers })
	@MultiORMOneToMany(() => CandidateInterviewers, (interviewers) => interviewers.interview, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	interviewers?: ICandidateInterviewers[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate })
	@MultiORMManyToOne(() => Candidate, (candidate) => candidate.interview, {
		onDelete: 'CASCADE'
	})
	candidate?: ICandidate;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateInterview) => it.candidate)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	candidateId?: ICandidate['id'];
}
