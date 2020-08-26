import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ISkill, Candidate as ICandidate } from '@gauzy/models';
import { Candidate } from '../candidate/candidate.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('candidate_skill')
export class CandidateSkill extends TenantBase implements ISkill {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ManyToOne((type) => Candidate, (candidate) => candidate.skills)
	candidate: ICandidate;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidateSkill: CandidateSkill) => candidateSkill.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
