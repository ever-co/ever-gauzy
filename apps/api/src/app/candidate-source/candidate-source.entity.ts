import { Column, Entity, RelationId } from 'typeorm';
import { Base } from '../core/entities/base';
import { ICandidateSource } from '@gauzy/models';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CandidateSkill } from '../candidate-skill/candidate-skill.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('candidate_source')
export class CandidateSource extends TenantBase implements ICandidateSource {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(candidateSource: CandidateSource) => candidateSource.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
