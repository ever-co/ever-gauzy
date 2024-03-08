import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';
import {
	ITenant,
	IOrganization,
	IRolePermission,
	IFeatureOrganization,
	IImportRecord,
	IImageAsset
} from '@gauzy/contracts';
import {
	BaseEntity,
	FeatureOrganization,
	ImageAsset,
	ImportRecord,
	Organization,
	RolePermission
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmTenantRepository } from './repository/mikro-orm-tenant.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('tenant', { mikroOrmRepository: () => MikroOrmTenantRepository })
export class Tenant extends BaseEntity implements ITenant {

	@ApiProperty({ type: () => String })
	@Index()
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
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Organization })
	@MultiORMOneToMany(() => Organization, (it) => it.tenant, {
		cascade: true
	})
	@JoinColumn()
	organizations?: IOrganization[];

	@ApiProperty({ type: () => RolePermission })
	@MultiORMOneToMany(() => RolePermission, (it) => it.tenant, {
		cascade: true
	})
	rolePermissions?: IRolePermission[];

	/**
	 * Array of feature organizations associated with the entity.
	 */
	@ApiProperty({ type: () => FeatureOrganization })
	@MultiORMOneToMany(() => FeatureOrganization, (it) => it.tenant, {
		cascade: true,
	})
	featureOrganizations?: IFeatureOrganization[];

	@ApiProperty({ type: () => ImportRecord })
	@MultiORMOneToMany(() => ImportRecord, (importRecord) => importRecord.tenant, {
		cascade: true
	})
	importRecords?: IImportRecord[];
}
