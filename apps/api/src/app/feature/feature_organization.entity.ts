import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Feature } from './feature.entity';
import { IFeature, IFeatureOrganization } from '@gauzy/models';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('feature_organization')
export class FeatureOrganization
	extends TenantOrganizationBase
	implements IFeatureOrganization {
	@ApiProperty({ type: Feature })
	@ManyToOne(() => Feature)
	@JoinColumn()
	feature: IFeature;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((feature: FeatureOrganization) => feature.feature)
	@Column()
	readonly featureId: string;

	@Column({ default: true })
	isEnabled: boolean;
}
