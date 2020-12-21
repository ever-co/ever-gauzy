import {
	AfterLoad,
	Column,
	Entity,
	Index,
	JoinColumn,
	OneToMany
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { FeatureOrganization } from './feature_organization.entity';
import { IFeature, IFeatureOrganization } from '@gauzy/models';
import { IsNotEmpty, IsString } from 'class-validator';
import { FileStorage } from '../core/file-storage';
import { gauzyToggleFeatures } from '@env-api/environment';

@Entity('feature')
export class Feature extends Base implements IFeature {
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

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	image?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column()
	link: string;

	isEnabled?: boolean;
	@AfterLoad()
	afterLoadEnabled?() {
		if (gauzyToggleFeatures.hasOwnProperty(this.code)) {
			const feature = gauzyToggleFeatures[this.code];
			this.isEnabled = feature;
		} else {
			this.isEnabled = true;
		}
	}

	imageUrl?: string;
	@AfterLoad()
	afterLoad?() {
		if (this.image) {
			this.imageUrl = new FileStorage().getProvider().url(this.image);
		}
	}
}
