import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	BaseEntity,
	FeatureOrganization,
	ImageAsset,
	ImportRecord,
	Organization,
	RolePermission
} from '../core/entities/internal';
import { Entity, Column, Index, OneToMany, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import {
	ITenant,
	IOrganization,
	IRolePermission,
	IFeatureOrganization,
	IImportRecord,
	IImageAsset
} from '@gauzy/contracts';

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
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	image?: ImageAsset;

	@ApiProperty({ type: () => String })
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
