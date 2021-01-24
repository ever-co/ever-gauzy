import { Column, Entity, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { IOrganizationVendor, ITag } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('organization_vendor')
export class OrganizationVendor
	extends TenantOrganizationBaseEntity
	implements IOrganizationVendor {
	constructor(input?: DeepPartial<OrganizationVendor>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationVendor)
	@JoinTable({
		name: 'tag_organization_vendor'
	})
	tags?: ITag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	email?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	phone?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	website?: string;
}
