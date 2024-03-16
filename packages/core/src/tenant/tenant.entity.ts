import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsOptional, IsUUID } from 'class-validator';
import {
	ITenant,
	IOrganization,
	IRolePermission,
	IFeatureOrganization,
	IImageAsset
} from '@gauzy/contracts';
import {
	BaseEntity,
	FeatureOrganization,
	ImageAsset,
	Organization,
	RolePermission
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmTenantRepository } from './repository/mikro-orm-tenant.repository';

@MultiORMEntity('tenant', { mikroOrmRepository: () => MikroOrmTenantRepository })
export class Tenant extends BaseEntity implements ITenant {

	// to allow inference in `em.getRepository()`
	[EntityRepositoryType]?: MikroOrmTenantRepository;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	logo?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: ImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Tenant) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => Organization, (it) => it.tenant, {
		cascade: true
	})
	@JoinColumn()
	organizations?: IOrganization[];

	@MultiORMOneToMany(() => RolePermission, (it) => it.tenant, {
		cascade: true
	})
	rolePermissions?: IRolePermission[];

	/**
	 * Array of feature organizations associated with the entity.
	 */
	@MultiORMOneToMany(() => FeatureOrganization, (it) => it.tenant, {
		cascade: true,
	})
	featureOrganizations?: IFeatureOrganization[];
}
