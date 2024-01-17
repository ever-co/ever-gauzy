import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IFeature, IFeatureOrganization } from '@gauzy/contracts';
import {
	Feature,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';
import { Entity } from '@gauzy/common';

@Entity('feature_organization')
export class FeatureOrganization
	extends TenantOrganizationBaseEntity
	implements IFeatureOrganization {

	@Column({ default: true })
	isEnabled: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Feature
	 */
	@ApiProperty({ type: () => Feature })
	@ManyToOne(() => Feature, (feature) => feature.featureOrganizations, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	feature: IFeature;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: FeatureOrganization) => it.feature)
	@IsString()
	@Index()
	@Column()
	readonly featureId: string;
}
