import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IExperience, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('candidate_experience')
export class CandidateExperience extends TenantBase implements IExperience {
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateExperience: CandidateExperience) =>
			candidateExperience.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
