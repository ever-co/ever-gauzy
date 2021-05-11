import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IFeature,
	IFeatureOrganization
} from '@gauzy/contracts';
import { IsNotEmpty, IsString } from 'class-validator';
import { BaseEntity, FeatureOrganization } from '../core/entities/internal';

@Entity('feature')
export class Feature extends BaseEntity implements IFeature {
	@ApiProperty({ type: () => FeatureOrganization })
	@OneToMany(
		() => FeatureOrganization,
		(featureOrganization) => featureOrganization.feature,
		{
			cascade: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	featureOrganizations?: IFeatureOrganization[];

	@ApiProperty({ type: () => Feature })
	@ManyToOne(() => Feature, (feature) => feature.children)
	parent: Feature;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	parentId?: string;

	@ApiProperty({ type: () => Feature })
	@OneToMany(() => Feature, (feature) => feature.parent, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'parentId' })
	children: Feature[];

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
}
