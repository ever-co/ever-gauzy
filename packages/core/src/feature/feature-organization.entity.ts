import { ApiProperty } from '@nestjs/swagger';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IFeature, IFeatureOrganization } from '@gauzy/contracts';
import {
	Feature,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmFeatureOrganizationRepository } from './repository/mikro-orm-feature-organization.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('feature_organization', { mikroOrmRepository: () => MikroOrmFeatureOrganizationRepository })
export class FeatureOrganization extends TenantOrganizationBaseEntity implements IFeatureOrganization {

	@MultiORMColumn({ default: true })
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
	@MultiORMManyToOne(() => Feature, (it) => it.featureOrganizations, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	feature: IFeature;

	@ApiProperty({ type: () => String })
	@RelationId((it: FeatureOrganization) => it.feature)
	@IsString()
	@Index()
	@MultiORMColumn({ relationId: true })
	featureId: IFeature['id'];
}
