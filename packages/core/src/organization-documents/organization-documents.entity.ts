import { Column, Entity } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IOrganizationDocument } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('organization_document')
export class OrganizationDocuments
	extends TenantOrganizationBaseEntity
	implements IOrganizationDocument {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@Column()
	documentUrl: string;
}
