import {
	Index,
	JoinColumn,
	RelationId
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	FeatureEnum,
	IFeature,
	IFeatureOrganization
} from '@gauzy/contracts';
import { BaseEntity, FeatureOrganization } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmFeatureRepository } from './repository/mikro-orm-feature.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('feature', { mikroOrmRepository: () => MikroOrmFeatureRepository })
export class Feature extends BaseEntity implements IFeature {

	@ApiProperty({ type: () => String })
	@Index()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@Index()
	@MultiORMColumn()
	code: FeatureEnum;

	@ApiProperty({ type: () => Boolean, default: false })
	@MultiORMColumn({ default: false })
	isPaid?: boolean;

	@ApiProperty({ type: () => String, readOnly: true })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@MultiORMColumn({ nullable: true })
	image: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@MultiORMColumn()
	link: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	status: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	icon: string;

	isEnabled?: boolean;
	imageUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Feature
	 */
	@ApiProperty({ type: () => Feature })
	@MultiORMManyToOne(() => Feature, (feature) => feature.children, {
		onDelete: 'CASCADE'
	})
	parent: IFeature;

	@ApiProperty({ type: () => String })
	@RelationId((it: Feature) => it.parent)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * FeatureOrganization
	 */
	@ApiProperty({ type: () => FeatureOrganization })
	@MultiORMOneToMany(() => FeatureOrganization, (featureOrganization) => featureOrganization.feature, {
		cascade: true
	})
	@JoinColumn()
	featureOrganizations?: IFeatureOrganization[];

	/**
	 * Feature
	 */
	@ApiProperty({ type: () => Feature })
	@MultiORMOneToMany(() => Feature, (feature) => feature.parent, {
		cascade: true
	})
	@JoinColumn({ name: 'parentId' })
	children: IFeature[];
}
