import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IExperience, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('candidate_experience')
export class CandidateExperience extends TenantOrganizationBase implements IExperience {
	@ApiProperty({ type: String })
	@Column()
	occupation: string;

	@ApiProperty({ type: String })
	@Column()
	duration: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.experience)
	candidate: ICandidate;
}
