import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { ICandidateTechnologies, ICandidateInterview } from '@gauzy/models';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

@Entity('candidate_technology')
export class CandidateTechnologies extends Base
	implements ICandidateTechnologies {
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
		(interview) => interview.technologies
	)
	interview: ICandidateInterview;
}
