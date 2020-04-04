import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { IOrganizationVendor } from '@gauzy/models';

@Entity('organization_vendor')
export class OrganizationVendor extends Base implements IOrganizationVendor {
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
	organizationId: string;
}
