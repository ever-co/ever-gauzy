import { Column, Entity } from 'typeorm';
import { ICandidateSource } from '@gauzy/models';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('candidate_source')
export class CandidateSource extends TenantOrganizationBase
	implements ICandidateSource {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	candidateId?: string;
}
