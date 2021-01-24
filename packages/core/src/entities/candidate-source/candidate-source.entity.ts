import { Column, Entity } from 'typeorm';
import { ICandidateSource } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('candidate_source')
export class CandidateSource
	extends TenantOrganizationBaseEntity
	implements ICandidateSource {
	constructor(input?: DeepPartial<CandidateSource>) {
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
}
