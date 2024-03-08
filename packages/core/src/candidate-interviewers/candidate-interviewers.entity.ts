import { RelationId, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers, ICandidateInterview, IEmployee } from '@gauzy/contracts';
import {
	CandidateInterview,
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCandidateInterviewersRepository } from './repository/mikro-orm-candidate-interviewers.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('candidate_interviewer', { mikroOrmRepository: () => MikroOrmCandidateInterviewersRepository })
export class CandidateInterviewers extends TenantOrganizationBaseEntity implements ICandidateInterviewers {
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => CandidateInterview })
	@MultiORMManyToOne(() => CandidateInterview, (interview) => interview.interviewers, {
		onDelete: 'CASCADE'
	})
	interview: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateInterviewers) => it.interview)
	@IsString()
	@Index()
	@MultiORMColumn({ relationId: true })
	interviewId: string;

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateInterviewers) => it.employee)
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId: string;
}
