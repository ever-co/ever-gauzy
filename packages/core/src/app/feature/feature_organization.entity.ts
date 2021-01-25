import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IFeature, IFeatureOrganization } from '@gauzy/contracts';
import {
	Feature,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('feature_organization')
export class FeatureOrganization
	extends TenantOrganizationBaseEntity
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
