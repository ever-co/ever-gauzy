import {
	Column,
	Entity,
	Index,
	ManyToMany,
	JoinTable,
	ManyToOne
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationVendor } from '@gauzy/models';
import { Tag } from '../tags/tag.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { Organization } from '../organization/organization.entity';

@Entity('organization_vendor')
export class OrganizationVendor extends TenantBase
	implements IOrganizationVendor {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationVendor)
	@JoinTable({
		name: 'tag_organization_vendor'
	})
	tags?: Tag[];

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

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization?: Organization;
}
