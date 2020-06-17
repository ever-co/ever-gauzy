import { Column, Entity, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { OrganizationPositions as IOrganizationPositions } from '@gauzy/models';
import { Tag } from '../tags/tag.entity';

@Entity('organization_position')
export class OrganizationPositions extends Base
	implements IOrganizationPositions {
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

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;
}
