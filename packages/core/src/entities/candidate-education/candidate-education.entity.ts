import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ICandidateEducation, ICandidate } from '@gauzy/common';
import { Candidate } from '../candidate/candidate.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('candidate_education')
export class CandidateEducation
	extends TenantOrganizationBase
	implements ICandidateEducation {
	@ApiProperty({ type: String })
	@Column()
	schoolName: string;

	@ApiProperty({ type: String })
	@Column()
	degree: string;

	@ApiProperty({ type: String })
	@Column()
	field: string;

	@ApiProperty({ type: Date })
	@Column()
	completionDate: Date;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.educations, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
