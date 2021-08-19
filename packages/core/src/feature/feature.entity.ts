import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	RelationId
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IFeature,
	IFeatureOrganization
} from '@gauzy/contracts';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BaseEntity, FeatureOrganization } from '../core/entities/internal';

@Entity('feature')
export class Feature extends BaseEntity implements IFeature {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	code: string;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isPaid?: boolean;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	image: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsString()
	@Column()
	link: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	status: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
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
	@ManyToOne(() => Feature, (feature) => feature.children, {
		onDelete: 'CASCADE'
	})
	parent: IFeature;

	@ApiProperty({ type: () => String })
	@RelationId((it: Feature) => it.parent)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
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
	@OneToMany(() => FeatureOrganization, (featureOrganization) => featureOrganization.feature, {
		cascade: true
	})
	@JoinColumn()
	featureOrganizations?: IFeatureOrganization[];
	
	/**
	 * Feature
	 */
	@ApiProperty({ type: () => Feature })
	@OneToMany(() => Feature, (feature) => feature.parent, {
		cascade: true
	})
	@JoinColumn({ name: 'parentId' })
	children: IFeature[];
}
