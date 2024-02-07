import { ApiProperty } from '@nestjs/swagger';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { Property } from '@mikro-orm/core';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { Organization, TenantBaseEntity } from '../entities/internal';
import { MikroManyToOne } from '../decorators/entity/relations/mikro-orm';
import { MultiORMManyToOne } from '../decorators/entity/relations';
import { MultiORMColumn } from '../decorators';

export abstract class TenantOrganizationBaseEntity extends TenantBaseEntity implements IBasePerTenantAndOrganizationEntityModel {

	@ApiProperty({ type: () => Organization })
	@MultiORMManyToOne(() => Organization, {
		nullable: true,
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@MikroManyToOne(() => Organization, {
		nullable: true,
		deleteRule: 'cascade',
		updateRule: 'cascade',
		persist: false
	})
	@JoinColumn()
	@IsOptional()
	organization?: IOrganization;

	@ApiProperty({ type: () => String })
	@RelationId((it: TenantOrganizationBaseEntity) => it.organization)
	@IsString()
	@IsOptional()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationId?: IOrganization['id'];
}
