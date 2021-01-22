import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ICandidateExperience, ICandidate, DeepPartial } from '@gauzy/common';
import { Candidate, TenantOrganizationBaseEntity } from '../internal';

@Entity('candidate_experience')
export class CandidateExperience
	extends TenantOrganizationBaseEntity
	implements ICandidateExperience {
	constructor(input?: DeepPartial<CandidateExperience>) {
		super(input);
	}

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

	@ManyToOne(() => Candidate, (candidate) => candidate.experience, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
