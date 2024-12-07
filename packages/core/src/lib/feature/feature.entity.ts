import {
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmFeatureRepository } from './repository/mikro-orm-feature.repository';

@MultiORMEntity('feature', { mikroOrmRepository: () => MikroOrmFeatureRepository })
export class Feature extends BaseEntity implements IFeature {

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
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

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	isEnabled?: boolean;

	@VirtualMultiOrmColumn()
	imageUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Feature
	 */
	@MultiORMManyToOne(() => Feature, (it) => it.children, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	parent: IFeature;

	@ApiProperty({ type: () => String })
	@RelationId((it: Feature) => it.parent)
	@ColumnIndex()
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
	@MultiORMOneToMany(() => FeatureOrganization, (it) => it.feature, {
		cascade: true
	})
	@JoinColumn()
	featureOrganizations?: IFeatureOrganization[];

	/**
	 * Feature
	 */
	@MultiORMOneToMany(() => Feature, (it) => it.parent, {
		cascade: true
	})
	@JoinColumn({ name: 'parentId' })
	children: IFeature[];
}
