import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidatePersonalQualities,
	ICandidateInterview
} from '@gauzy/models';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { Base } from '../core/entities/base';

@Entity('candidate_personal_quality')
export class CandidatePersonalQualities extends Base
	implements ICandidatePersonalQualities {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ManyToOne(
		(type) => CandidateInterview,
		(interview) => interview.personalQualities
	)
	interview: ICandidateInterview;
}
