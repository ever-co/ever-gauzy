import {
	AfterLoad,
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
	IFeatureOrganization,
	FeatureStatusEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { IsNotEmpty, IsString } from 'class-validator';
import * as _ from 'underscore';
import { BaseEntity, FeatureOrganization } from '../internal';
// import { FileStorage } from '../core/file-storage';
// import { gauzyToggleFeatures } from '@env-api/environment';

@Entity('feature')
export class Feature extends BaseEntity implements IFeature {
	constructor(input?: DeepPartial<Feature>) {
		super(input);
	}

	@ApiProperty({ type: FeatureOrganization })
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

	@ApiProperty({ type: Feature })
	@ManyToOne((type) => Feature, (feature) => feature.children)
	parent: Feature;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	parentId?: string;

	@ApiProperty({ type: Feature })
	@OneToMany((type) => Feature, (feature) => feature.parent, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'parentId' })
	children: Feature[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	code: string;

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isPaid?: boolean;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	image: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column()
	link: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	status: string;

	@AfterLoad()
	afterLoadStatus() {
		if (!this.status) {
			this.status = _.shuffle(Object.values(FeatureStatusEnum))[0];
		}
	}

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	icon: string;

	isEnabled?: boolean;
	@AfterLoad()
	afterLoadEnabled?() {
		// if (gauzyToggleFeatures.hasOwnProperty(this.code)) {
		// 	const feature = gauzyToggleFeatures[this.code];
		// 	this.isEnabled = feature;
		// } else {
		this.isEnabled = true;
		// }
	}

	imageUrl?: string;
	@AfterLoad()
	afterLoad?() {
		if (this.image) {
			// this.imageUrl = new FileStorage().getProvider().url(this.image);
		}
	}
}
