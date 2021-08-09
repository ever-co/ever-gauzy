import { Entity, Column, ManyToOne, RelationId, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ICandidateInterviewers, ICandidateInterview, IEmployee } from '@gauzy/contracts';
import {
	CandidateInterview,
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';

@Entity('candidate_interviewer')
export class CandidateInterviewers
	extends TenantOrganizationBaseEntity
	implements ICandidateInterviewers {
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => CandidateInterview })
	@ManyToOne( () => CandidateInterview, (interview) => interview.interviewers, {
		onDelete: 'CASCADE'
	})
	interview: ICandidateInterview;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateInterviewers) => it.interview)
	@IsString()
	@Index()
	@Column()
	interviewId: string;

	@ApiProperty({ type: () => Employee })
	@ManyToOne( () => Employee, {
		onDelete: 'CASCADE'
	})
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: CandidateInterviewers) => it.employee)
	@IsString()
	@Index()
	@Column({ nullable: true })
	employeeId: string;
}
