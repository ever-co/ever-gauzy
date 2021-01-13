import { Column, Entity } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IOrganizationDocument } from '@gauzy/common';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('organization_document')
export class OrganizationDocuments
	extends TenantOrganizationBase
	implements IOrganizationDocument {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiPropertyOptional({ type: String })
	@Column()
	documentUrl: string;
}
