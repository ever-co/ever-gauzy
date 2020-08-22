import { Column, Entity } from 'typeorm';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationDocument as IOrganizationDocument } from '@gauzy/models';

@Entity('organization_document')
export class OrganizationDocuments extends Base
	implements IOrganizationDocument {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	organizationId: string;

	@ApiPropertyOptional({ type: String })
	@Column()
	documentUrl: string;
}
