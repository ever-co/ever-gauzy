import { Column, Entity, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { IOrganizationVendor } from '@gauzy/models';
import { Tag } from '../tags/tag.entity';

@Entity('organization_vendor')
export class OrganizationVendor extends Base implements IOrganizationVendor {
	@ApiProperty()
	@ManyToMany((type) => Tag)
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
}
