import { Column, DeepPartial, Entity } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IOrganizationDocument } from '@gauzy/common';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('organization_document')
export class OrganizationDocuments
	extends TenantOrganizationBaseEntity
	implements IOrganizationDocument {
	constructor(input?: DeepPartial<OrganizationDocuments>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiPropertyOptional({ type: String })
	@Column()
	documentUrl: string;
}
