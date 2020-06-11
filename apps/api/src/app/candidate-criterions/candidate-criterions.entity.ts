import { Base } from '../core/entities/base';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidateCriterion,
	ICandidatePersonalQualities,
	ICandidateTechnologies
} from '@gauzy/models';
import { Entity, ManyToOne, JoinTable, Column } from 'typeorm';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';

@Entity('candidate_criterion')
export class CandidateCriterions extends Base implements ICandidateCriterion {
	@ManyToOne((type) => CandidatePersonalQualities)
	@JoinTable({
		name: 'candidate_personal_quality'
	})
	personalQualities: ICandidatePersonalQualities[];

	@ManyToOne((type) => CandidateTechnologies)
	@JoinTable({
		name: 'candidate_technology'
	})
	technologies: ICandidateTechnologies[];

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	interviewId: string;
}
