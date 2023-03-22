import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Entity, Column, Index, OneToMany, JoinColumn, ManyToOne, RelationId } from 'typeorm';
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

@Entity('tenant')
export class Tenant extends BaseEntity implements ITenant {
	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	name?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	logo?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * ImageAsset
	 */
	@ManyToOne(() => ImageAsset, {
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
	@Column({ nullable: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Organization })
	@OneToMany(() => Organization, (organization) => organization.tenant, {
		cascade: true
	})
	@JoinColumn()
	organizations?: IOrganization[];

	@ApiProperty({ type: () => RolePermission })
	@OneToMany(() => RolePermission, (rolePermission) => rolePermission.tenant, {
		cascade: true
	})
	rolePermissions?: IRolePermission[];

	@ApiProperty({ type: () => FeatureOrganization })
	@OneToMany(() => FeatureOrganization, (featureOrganization) => featureOrganization.tenant, {
		cascade: true
	})
	featureOrganizations?: IFeatureOrganization[];

	@ApiProperty({ type: () => ImportRecord })
	@OneToMany(() => ImportRecord, (importRecord) => importRecord.tenant, {
		cascade: true
	})
	importRecords?: IImportRecord[];
}
