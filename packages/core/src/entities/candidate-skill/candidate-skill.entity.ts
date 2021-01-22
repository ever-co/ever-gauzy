import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ICandidateSkill, ICandidate, DeepPartial } from '@gauzy/common';
import { Candidate, TenantOrganizationBaseEntity } from '../internal';

@Entity('candidate_skill')
export class CandidateSkill
	extends TenantOrganizationBaseEntity
	implements ICandidateSkill {
	constructor(input?: DeepPartial<CandidateSkill>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne(() => Candidate, (candidate) => candidate.skills, {
		onDelete: 'CASCADE'
	})
	candidate: ICandidate;
}
