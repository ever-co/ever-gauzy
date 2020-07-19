import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { OrganizationAwards as IOrganizationAwards } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';

@Entity('organization_awards')
export class OrganizationAwards extends Base implements IOrganizationAwards {
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

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
