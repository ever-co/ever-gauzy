import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ICandidateEducation, ICandidate } from '@gauzy/contracts';
import {
	Candidate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('candidate_education')
export class CandidateEducation
	extends TenantOrganizationBaseEntity
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

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne(() => Candidate, (candidate) => candidate.educations, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
