import { Column, Entity, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationPosition } from '@gauzy/models';
import { Tag } from '../tags/tag.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('organization_position')
export class OrganizationPositions extends TenantOrganizationBase
	implements IOrganizationPosition {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationPosition)
	@JoinTable({
		name: 'tag_organization_position'
	})
	tags: Tag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;
}
