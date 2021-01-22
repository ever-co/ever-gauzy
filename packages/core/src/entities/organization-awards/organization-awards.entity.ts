import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { DeepPartial, IOrganizationAwards } from '@gauzy/common';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('organization_award')
export class OrganizationAwards
	extends TenantOrganizationBaseEntity
	implements IOrganizationAwards {
	constructor(input?: DeepPartial<OrganizationAwards>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	year: string;
}
