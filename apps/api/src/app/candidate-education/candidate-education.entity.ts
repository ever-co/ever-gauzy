import { Column, Entity, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IEducation, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { Organization } from '../organization/organization.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('candidate_education')
export class CandidateEducation extends TenantBase implements IEducation {
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

	@ManyToOne((type) => Candidate, (candidate) => candidate.educations)
	candidate: ICandidate;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateEducation: CandidateEducation) =>
			candidateEducation.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
