import { Column, Entity, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationPosition } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Tag, TenantOrganizationBaseEntity } from '../internal';

@Entity('organization_position')
export class OrganizationPositions
	extends TenantOrganizationBaseEntity
	implements IOrganizationPosition {
	constructor(input?: DeepPartial<OrganizationPositions>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationPosition)
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
